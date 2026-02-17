package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"runtime"
	"strconv"
	"syscall"
	"time"

	"github.com/hpcloud/tail"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gopsutilnet "github.com/shirou/gopsutil/v3/net"
	"gopkg.in/yaml.v3"
)

type Config struct {
	ServerID   string              `yaml:"server_id"`
	BackendURL string              `yaml:"backend_url"`
	Interval   int                 `yaml:"interval"`
	Logs       map[string][]string `yaml:"logs"`
}

type ServerPayload struct {
	ID           string `json:"id"`
	Hostname     string `json:"hostname"`
	IP           string `json:"ip"`
	OS           string `json:"os"`
	Status       string `json:"status"`
	AgentVersion string `json:"agentVersion"`
}

type MetricPayload struct {
	ServerID   string  `json:"server_id"`
	CPU        float64 `json:"cpu"`
	Memory     float64 `json:"memory"`
	Disk       float64 `json:"disk"`
	NetworkIn  float64 `json:"network_in"`
	NetworkOut float64 `json:"network_out"`
}

type WebLogPayload struct {
	ServerID     string `json:"server_id"`
	Method       string `json:"method"`
	Path         string `json:"path"`
	Status       int    `json:"status"`
	ResponseTime int    `json:"response_time"`
	IP           string `json:"ip"`
	UserAgent    string `json:"user_agent"`
}

type AppLogPayload struct {
	ServerID string `json:"server_id"`
	Service  string `json:"service"`
	Level    string `json:"level"`
	Message  string `json:"message"`
}

// Simple regex for Nginx/Apache Combined Log Format with extra response time
// format: $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" $request_time
// Format: Host "Method Path Protocol" Status RequestTime
// 172.68.229.185 - - [17/Feb/2026:04:18:57 +0000] "POST /talent/application_with_cv/be2c5fd8-9396-45bb-a22d-bbfc119b8958/ HTTP/1.1" 400 67 "-" "python-requests/2.32.3"
var webLogRegex = regexp.MustCompile(`^(\S+) \S+ \S+ \[.*?\] "(\S+) (\S+) \S+" (\d+) \d+ ".*?" "(.*?)"`)

func loadConfig(path string) (*Config, error) {
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	err = yaml.Unmarshal(file, &cfg)
	return &cfg, err
}

func registerServer(cfg *Config) {
	hostname, _ := os.Hostname()

	// Get outbound IP logic
	ip := "unknown"
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		localAddr := conn.LocalAddr().(*net.UDPAddr)
		ip = localAddr.IP.String()
		conn.Close()
	}

	info, _ := host.Info()
	osInfo := fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion)
	if info.Platform == "" {
		osInfo = runtime.GOOS
	}

	payload := ServerPayload{
		ID:           cfg.ServerID,
		Hostname:     hostname,
		IP:           ip,
		OS:           osInfo,
		Status:       "active",
		AgentVersion: "v1.0.0",
	}

	log.Printf("Registering server: %+v", payload)
	sendData(cfg.BackendURL+"/v1/register", payload)
}

func collectMetrics(cfg *Config) {
	ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	for range ticker.C {
		c, _ := cpu.Percent(0, false)
		m, _ := mem.VirtualMemory()
		d, _ := disk.Usage("/")
		n, _ := gopsutilnet.IOCounters(false) // Use aliased gopsutilnet

		payload := MetricPayload{
			ServerID:   cfg.ServerID,
			CPU:        c[0],
			Memory:     m.UsedPercent,
			Disk:       d.UsedPercent,
			NetworkIn:  float64(n[0].BytesRecv) / 1024 / 1024,
			NetworkOut: float64(n[0].BytesSent) / 1024 / 1024,
		}

		sendData(cfg.BackendURL+"/v1/ingest/metrics", payload)
	}
}

func tailLogs(cfg *Config, filePath string, logType string) {
	t, err := tail.TailFile(filePath, tail.Config{Follow: true, ReOpen: true})
	if err != nil {
		log.Printf("Error tailing %s: %v", filePath, err)
		return
	}

	for line := range t.Lines {
		if line.Text == "" {
			continue
		}

		if logType == "web" {
			matches := webLogRegex.FindStringSubmatch(line.Text)
			if matches != nil {
				// 1: IP, 2: Method, 3: Path, 4: Status, 5: UserAgent
				status, _ := strconv.Atoi(matches[4])

				// Standard Nginx format doesn't have request_time by default, so 0
				respTimeMs := 0

				payload := WebLogPayload{
					ServerID:     cfg.ServerID,
					Method:       matches[2],
					Path:         matches[3],
					Status:       status,
					ResponseTime: respTimeMs,
					IP:           matches[1],
					UserAgent:    matches[5],
				}
				sendData(cfg.BackendURL+"/v1/ingest/logs/web", payload)
			}
		} else {
			// Treat as app log
			payload := AppLogPayload{
				ServerID: cfg.ServerID,
				Service:  logType, // Use logType ("app", "db", etc) as service name
				Level:    "INFO",
				Message:  line.Text,
			}
			sendData(cfg.BackendURL+"/v1/ingest/logs/app", payload)
		}
	}
}

func sendData(url string, data interface{}) {
	jsonData, _ := json.Marshal(data)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to ship data to %s: %v", url, err)
		return
	}
	defer resp.Body.Close()
}

func main() {
	configPath := "/etc/sentinel/agent.yaml"
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		configPath = "agent.yaml"
	}

	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("Error loading config: %v", err)
	}

	if cfg.ServerID == "" {
		hostname, err := os.Hostname()
		if err != nil {
			log.Printf("Warning: could not get hostname: %v", err)
			cfg.ServerID = "unknown-host"
		} else {
			cfg.ServerID = hostname
		}
	}

	log.Printf("Sentinel Agent starting for server: %s", cfg.ServerID)
	registerServer(cfg)

	go collectMetrics(cfg)

	for logType, files := range cfg.Logs {
		for _, file := range files {
			go tailLogs(cfg, file, logType)
		}
	}

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
	log.Println("Sentinel Agent shutting down...")
}
