# Requirements Document

## Introduction

This feature adds login-based authentication to the Sentinel fleet management dashboard. Currently the React + TypeScript frontend (Vite) and FastAPI Python backend are fully open — any user with network access can view fleet data, logs, and metrics. This feature introduces a login screen, session management via JWT tokens, protected routes on the frontend, and authenticated API endpoints on the backend, ensuring only authorized operators can access the dashboard.

## Glossary

- **Auth_Service**: The FastAPI backend module responsible for issuing and validating authentication tokens.
- **Login_Form**: The React UI component that collects and submits user credentials.
- **Auth_Context**: The React context provider that holds the current session state and exposes login/logout actions to the component tree.
- **Protected_Route**: A React component that redirects unauthenticated users to the login page before rendering dashboard content.
- **JWT**: JSON Web Token — a signed, stateless token used to represent an authenticated session.
- **Access_Token**: A short-lived JWT issued by the Auth_Service upon successful login, used to authorize API requests.
- **Refresh_Token**: A longer-lived token used to obtain a new Access_Token without requiring the user to log in again.
- **Credentials**: A username and password pair submitted by the user.
- **Operator**: An authenticated user of the Sentinel dashboard.
- **Session**: The period of authenticated access between a successful login and logout or token expiry.

---

## Requirements

### Requirement 1: Login Page

**User Story:** As an unauthenticated visitor, I want to see a login page when I access the dashboard, so that I am prompted to authenticate before viewing any fleet data.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to any dashboard route, THE Protected_Route SHALL redirect the user to the `/login` path.
2. THE Login_Form SHALL render a username input field, a password input field, and a submit button.
3. WHILE the login submission is in progress, THE Login_Form SHALL disable the submit button and display a loading indicator.
4. IF the user submits the Login_Form with an empty username or empty password, THEN THE Login_Form SHALL display a validation error message without submitting the request to the Auth_Service.
5. THE Login_Form SHALL match the dark visual style of the existing Sentinel dashboard (dark slate background, blue accent colors).

---

### Requirement 2: Authentication via Backend

**User Story:** As an operator, I want my credentials to be verified by the backend, so that only users with valid accounts can access the dashboard.

#### Acceptance Criteria

1. WHEN the Login_Form is submitted with a non-empty username and non-empty password, THE Login_Form SHALL send a POST request to the `/v1/auth/login` endpoint with the Credentials.
2. WHEN the Auth_Service receives a POST request to `/v1/auth/login` with valid Credentials, THE Auth_Service SHALL return an Access_Token and a Refresh_Token in the response body.
3. WHEN the Auth_Service receives a POST request to `/v1/auth/login` with invalid Credentials, THE Auth_Service SHALL return an HTTP 401 response with a descriptive error message.
4. IF the Auth_Service returns an HTTP 401 response, THEN THE Login_Form SHALL display the error message returned by the Auth_Service below the submit button.
5. THE Auth_Service SHALL store user records with hashed passwords using bcrypt with a minimum cost factor of 12.

---

### Requirement 3: Session Management

**User Story:** As an operator, I want my session to persist across page refreshes, so that I do not have to log in again every time I reload the dashboard.

#### Acceptance Criteria

1. WHEN the Auth_Service returns a successful login response, THE Auth_Context SHALL store the Access_Token in memory and the Refresh_Token in an HttpOnly cookie.
2. WHILE a valid Access_Token is held in memory, THE Auth_Context SHALL attach the Access_Token as a `Bearer` token in the `Authorization` header of every request made by the `sentinelApi` service.
3. WHEN the application loads and no Access_Token is in memory, THE Auth_Context SHALL attempt to obtain a new Access_Token by sending a POST request to `/v1/auth/refresh` using the stored Refresh_Token cookie.
4. IF the `/v1/auth/refresh` request fails or no Refresh_Token cookie exists, THEN THE Auth_Context SHALL set the session state to unauthenticated, causing the Protected_Route to redirect to `/login`.
5. THE Access_Token SHALL have an expiry of 15 minutes and THE Refresh_Token SHALL have an expiry of 7 days.

---

### Requirement 4: Protected API Endpoints

**User Story:** As a system administrator, I want all data API endpoints to require a valid token, so that fleet data cannot be accessed without authentication.

#### Acceptance Criteria

1. THE Auth_Service SHALL expose a reusable FastAPI dependency that validates the `Authorization: Bearer <token>` header on incoming requests.
2. WHEN a request arrives at any `/v1/query/*` or `/v1/ingest/*` endpoint without a valid Access_Token, THE Auth_Service SHALL return an HTTP 401 response.
3. WHEN a request arrives at any `/v1/query/*` or `/v1/ingest/*` endpoint with a valid Access_Token, THE Auth_Service SHALL allow the request to proceed to the handler.
4. THE `/v1/health` and `/v1/auth/login` endpoints SHALL remain publicly accessible without a token.

---

### Requirement 5: Logout

**User Story:** As an operator, I want to be able to log out, so that my session is terminated and the dashboard is no longer accessible from my browser.

#### Acceptance Criteria

1. THE dashboard layout SHALL display a logout button visible to authenticated operators on all dashboard views.
2. WHEN an operator activates the logout button, THE Auth_Context SHALL clear the Access_Token from memory and send a POST request to `/v1/auth/logout` to invalidate the Refresh_Token cookie.
3. WHEN the `/v1/auth/logout` request completes (success or failure), THE Auth_Context SHALL redirect the operator to the `/login` page.
4. WHEN the Auth_Service receives a POST request to `/v1/auth/logout`, THE Auth_Service SHALL clear the Refresh_Token HttpOnly cookie in the response.

---

### Requirement 6: Token Refresh

**User Story:** As an operator with an active session, I want my Access_Token to be refreshed automatically, so that my session does not expire mid-use without warning.

#### Acceptance Criteria

1. WHEN the `sentinelApi` service receives an HTTP 401 response from a protected endpoint, THE Auth_Context SHALL attempt one silent token refresh by calling `/v1/auth/refresh`.
2. WHEN the silent refresh succeeds, THE Auth_Context SHALL retry the original failed request with the new Access_Token.
3. IF the silent refresh fails, THEN THE Auth_Context SHALL set the session state to unauthenticated and redirect the operator to `/login`.
4. THE Auth_Context SHALL serialize concurrent refresh attempts so that only one `/v1/auth/refresh` request is in flight at a time.
