# Implementation Plan: fleet-auth-login

## Overview

Implement login-based authentication for the Sentinel dashboard. The work is split into backend auth infrastructure, frontend routing and context, UI components, API integration, and wiring everything together.

## Tasks

- [x] 1. Add auth types and install dependencies
  - Add `AuthUser`, `LoginCredentials`, `TokenResponse` interfaces to `types.ts`
  - Install `react-router-dom` v6 on the frontend (`npm install react-router-dom @types/react-router-dom`)
  - Add `python-jose[cryptography]`, `passlib[bcrypt]`, and `python-multipart` to `requirements.txt` / `pyproject.toml`
  - _Requirements: 2.2, 3.1_

- [x] 2. Implement backend auth service and endpoints
  - [x] 2.1 Create `services/auth_service.py` with password hashing, JWT creation/validation, and user lookup
    - Implement `hash_password`, `verify_password` using `passlib[bcrypt]` with cost factor 12
    - Implement `create_access_token` (15 min expiry) and `create_refresh_token` (7 day expiry) using `python-jose`
    - Implement `verify_token` that raises HTTP 401 on invalid/expired tokens
    - Read `JWT_SECRET` from environment variable
    - _Requirements: 2.5, 3.5_

  - [ ]* 2.2 Write property test for token expiry claims (Property 7)
    - **Property 7: Token expiry claims match specification**
    - **Validates: Requirements 3.5**
    - Generate arbitrary token payloads, create tokens, decode and assert `exp - iat` equals 15 min for access tokens and 7 days for refresh tokens
    - Tag: `# Feature: fleet-auth-login, Property 7`

  - [ ]* 2.3 Write property test for bcrypt cost factor (Property 5)
    - **Property 5: Passwords are stored as bcrypt hashes with cost factor ≥ 12**
    - **Validates: Requirements 2.5**
    - Generate arbitrary plaintext passwords, call `hash_password`, inspect embedded cost factor in the resulting hash string
    - Tag: `# Feature: fleet-auth-login, Property 5`

  - [x] 2.4 Add `get_current_user` FastAPI dependency in `services/auth_service.py`
    - Use `OAuth2PasswordBearer` scheme pointing to `/v1/auth/login`
    - Call `verify_token` and return the decoded payload; raise HTTP 401 on failure
    - _Requirements: 4.1_

  - [x] 2.5 Add auth endpoints to `main.py` (`/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`)
    - `POST /v1/auth/login`: validate `LoginRequest`, look up user in MongoDB, verify bcrypt hash, return `TokenResponse` + set HttpOnly `refresh_token` cookie
    - `POST /v1/auth/refresh`: read `refresh_token` cookie, validate it, return new `TokenResponse`
    - `POST /v1/auth/logout`: clear `refresh_token` cookie in response
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 5.4_

  - [ ]* 2.6 Write property test for invalid credentials returning 401 (Property 4)
    - **Property 4: Invalid credentials always return 401**
    - **Validates: Requirements 2.3**
    - Generate arbitrary username/password pairs that do not match any stored user, POST to `/v1/auth/login`, assert HTTP 401
    - Tag: `# Feature: fleet-auth-login, Property 4`

  - [ ]* 2.7 Write property test for valid login returning both tokens (Property 3)
    - **Property 3: Valid login returns both tokens**
    - **Validates: Requirements 2.2, 3.1**
    - Create a test user, generate valid credentials, POST to `/v1/auth/login`, assert non-empty `access_token` and `refresh_token` cookie present
    - Tag: `# Feature: fleet-auth-login, Property 3`

  - [x] 2.8 Apply `get_current_user` dependency to all `/v1/query/*` and `/v1/ingest/*` routes in `main.py`
    - Add `dependencies=[Depends(get_current_user)]` to each protected route or router group
    - Leave `/v1/health`, `/v1/auth/*`, and `/v1/register` unprotected
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ]* 2.9 Write property test for protected endpoint enforcement (Property 8)
    - **Property 8: Protected endpoints enforce authentication**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate requests to `/v1/query/*` and `/v1/ingest/*` with valid, invalid, and missing tokens; assert 401 iff token is absent or invalid
    - Tag: `# Feature: fleet-auth-login, Property 8`

  - [ ]* 2.10 Write backend unit tests (pytest)
    - `/v1/health` returns 200 without a token (Req 4.4)
    - `/v1/auth/login` returns 200 without a token (Req 4.4)
    - `/v1/auth/logout` clears the refresh token cookie (Req 5.4)
    - Backend sets HttpOnly flag on refresh token cookie (Req 3.1)
<!-- 
- [x] 3. Checkpoint — ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise. -->

- [x] 4. Implement frontend routing with React Router v6
  - Wrap `index.tsx` entry point with `<BrowserRouter>`
  - Define routes: `<Route path="/login" element={<LoginPage />} />` and `<Route path="/*" element={<ProtectedRoute><App /></ProtectedRoute>} />`
  - _Requirements: 1.1_

- [ ] 5. Implement `AuthContext` (`src/auth/AuthContext.tsx`)
  - [x] 5.1 Create `AuthContext` with `AuthState` and `AuthContextValue` interfaces
    - Hold `accessToken` in a `useRef` (not state) to avoid re-renders; expose `isAuthenticated` and `isLoading` as state
    - On mount, fire `POST /v1/auth/refresh`; set `isLoading = true` until response; on failure set unauthenticated
    - Implement `login(username, password)`: call `authApi.login`, store returned `access_token` in ref, set `isAuthenticated = true`
    - Implement `logout()`: clear token ref, call `authApi.logout`, redirect to `/login` regardless of API result
    - _Requirements: 3.1, 3.3, 3.4, 5.2, 5.3_

  - [ ]* 5.2 Write unit tests for `AuthContext` (Vitest + React Testing Library)
    - Fires refresh request on mount when no token in memory (Req 3.3)
    - Sets unauthenticated state when refresh fails on mount (Req 3.4)
    - Stores access token in memory after successful login (Req 3.1)
    - Clears token and calls logout endpoint when logout is triggered (Req 5.2)
    - Redirects to `/login` after logout regardless of API result (Req 5.3)

- [ ] 6. Implement token refresh interceptor and `authApi` in `services/apiService.ts`
  - [x] 6.1 Add `authApi` object with `login`, `refresh`, and `logout` methods
    - `login`: POST to `/v1/auth/login` with JSON body, return `LoginResponse`
    - `refresh`: POST to `/v1/auth/refresh` (cookie sent automatically), return `LoginResponse`
    - `logout`: POST to `/v1/auth/logout`
    - _Requirements: 2.1, 5.2_

  - [x] 6.2 Add a refresh mutex and 401 interceptor to `sentinelApi`
    - Wrap each `sentinelApi` fetch call to inject `Authorization: Bearer <token>` header from `AuthContext`
    - On 401 response, acquire mutex, call `authApi.refresh()` once, release mutex, retry original request with new token
    - If refresh fails, call `AuthContext.logout()`
    - _Requirements: 3.2, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.3 Write property test for Bearer header injection (Property 6)
    - **Property 6: All authenticated API requests carry a Bearer token**
    - **Validates: Requirements 3.2**
    - Generate arbitrary `sentinelApi` calls with a non-null token in context; intercept fetch; assert `Authorization` header equals `Bearer <token>`
    - Tag: `# Feature: fleet-auth-login, Property 6`

  - [ ]* 6.4 Write property test for concurrent 401 / single refresh (Property 9)
    - **Property 9: Concurrent 401 responses trigger exactly one refresh**
    - **Validates: Requirements 6.4, 6.1, 6.2**
    - Simulate N concurrent API requests all receiving 401; assert exactly one call to `/v1/auth/refresh` and all N requests retried with new token
    - Tag: `# Feature: fleet-auth-login, Property 9`

  - [ ]* 6.5 Write unit tests for silent refresh behavior
    - Silent refresh retries original request with new token on success (Req 6.2)
    - Silent refresh failure redirects to `/login` (Req 6.3)

- [ ] 7. Implement `ProtectedRoute` and `LoginPage` / `LoginForm` components
  - [x] 7.1 Create `src/auth/ProtectedRoute.tsx`
    - If `isLoading`, render a centered spinner
    - If `!isAuthenticated`, render `<Navigate to="/login" replace />`
    - Otherwise render `children`
    - _Requirements: 1.1_

  - [ ]* 7.2 Write property test for ProtectedRoute redirect (Property 1)
    - **Property 1: Unauthenticated users are always redirected**
    - **Validates: Requirements 1.1**
    - Render `ProtectedRoute` with arbitrary `isAuthenticated = false` and `isLoading = false` states; assert output is a redirect to `/login`
    - Tag: `# Feature: fleet-auth-login, Property 1`

  - [x] 7.3 Create `src/auth/LoginForm.tsx`
    - Controlled form with `username`, `password`, `isSubmitting`, and `error` state
    - Client-side validation: trim both fields; if either is empty, set error and do not call API
    - On submit, call `AuthContext.login()`; on 401, display error from response body; on 5xx/network error, display generic message
    - Disable submit button and show spinner while `isSubmitting` is true
    - Match dark slate / blue accent visual style of existing dashboard
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.4_

  - [ ]* 7.4 Write property test for empty/whitespace credential rejection (Property 2)
    - **Property 2: Empty or whitespace credentials are rejected client-side**
    - **Validates: Requirements 1.4**
    - Generate combinations where at least one field is empty or whitespace-only; assert error displayed and zero calls to `/v1/auth/login`
    - Tag: `# Feature: fleet-auth-login, Property 2`

  - [ ]* 7.5 Write unit tests for `LoginForm` (Vitest + React Testing Library)
    - Renders username input, password input, and submit button (Req 1.2)
    - Disables submit button and shows spinner while submitting (Req 1.3)
    - Displays backend error message on 401 (Req 2.4)

  - [x] 7.6 Create `src/auth/LoginPage.tsx`
    - Renders `LoginForm` centered on a dark slate background
    - If already authenticated, redirect to `/`
    - _Requirements: 1.5_

- [x] 8. Add logout button to dashboard layout in `App.tsx`
  - Add a logout button to the sidebar or top bar, visible on all dashboard views when authenticated
  - On click, call `AuthContext.logout()`
  - _Requirements: 5.1, 5.2_

  - [ ]* 8.1 Write unit test for logout button visibility
    - Logout button is visible in dashboard layout when authenticated (Req 5.1)

- [ ] 9. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `hypothesis` (Python backend) and `fast-check` (TypeScript frontend), minimum 100 iterations each
- Each property test must include the comment tag `# Feature: fleet-auth-login, Property <N>: <text>`
- `JWT_SECRET` must be set as an environment variable before running the backend
