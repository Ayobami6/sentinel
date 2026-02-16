
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hpcloud/tail"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"gopkg.in/yaml.v3"
)

type Config struct {
	ServerID   string   `yaml:"server_id"`
	BackendURL string   `yaml:"backend_url"`
	Interval   int      `yaml:"interval"`
	LogFiles   []string `yaml:"log_files"`
}

type MetricPayload struct {
	ServerID   string  `json:"server_id"`
	CPU        float64 `json:"cpu"`
	Memory     float64 `json:"memory"`
	Disk       float64 `json:"disk"`
	NetworkIn  float64 `json:"network_in"`
	NetworkOut float64 `json:"network_out"`
}

type LogPayload struct {
	ServerID string `json:"server_id"`
	Method   string `json:"method,omitempty"`
	Path     string `json:"path,omitempty"`
	Status   int    `json:"status,omitempty"`
	Level    string `json:"level,omitempty"`
	Message  string `json:"message"`
	Service  string `json:"service"`
}

func loadConfig(path string) (*Config, error) {
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	err = yaml.Unmarshal(file, &cfg)
	return &cfg, err
}

func collectMetrics(cfg *Config) {
	ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	for range ticker.C {
		c, _ := cpu.Percent(0, false)
		m, _ := mem.VirtualMemory()
		d, _ := disk.Usage("/")
		n, _ := net.IOCounters(false)

		payload := MetricPayload{
			ServerID:   cfg.ServerID,
			CPU:        c[0],
			Memory:     m.UsedPercent,
			Disk:       d.UsedPercent,
			NetworkIn:  float64(n[0].BytesRecv) / 1024 / 1024, // MB
			NetworkOut: float64(n[0].BytesSent) / 1024 / 1024, // MB
		}

		sendData(cfg.BackendURL+"/ingest/metrics", payload)
	}
}

func tailLogs(cfg *Config, filePath string) {
	t, err := tail.TailFile(filePath, tail.Config{Follow: true, ReOpen: true})
	if err != nil {
		log.Printf("Error tailing %s: %v", filePath, err)
		return
	}

	for line := range t.Lines {
		payload := LogPayload{
			ServerID: cfg.ServerID,
			Service:  "agent-tail",
			Message:  line.Text,
		}
		// In a real scenario, you'd regex the line to determine if it's a Web Log or App Log
		endpoint := cfg.BackendURL + "/ingest/logs/app"
		sendData(endpoint, payload)
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
		configPath = "agent.yaml" // Fallback to local for dev
	}

	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("Error loading config: %v", err)
	}

	log.Printf("Sentinel Agent starting for server: %s", cfg.ServerID)

	go collectMetrics(cfg)

	for _, logFile := range cfg.LogFiles {
		go tailLogs(cfg, logFile)
	}

	// Handle graceful shutdown
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
	log.Println("Sentinel Agent shutting down...")
}
