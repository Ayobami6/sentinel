
#!/bin/bash
# This script illustrates how to package the agent into a .deb file
# Requires 'dpkg-deb' and a compiled 'sentinel-agent' binary

mkdir -p build/usr/bin
mkdir -p build/etc/sentinel
mkdir -p build/lib/systemd/system
mkdir -p build/DEBIAN

# Build the Go binary (requires Go installed)
# go build -o sentinel-agent main.go

cp sentinel-agent build/usr/bin/
cp agent.yaml build/etc/sentinel/
cp sentinel-agent.service build/lib/systemd/system/
cp debian-control build/DEBIAN/control
cp postinst build/DEBIAN/postinst
chmod 755 build/DEBIAN/postinst

dpkg-deb --build build sentinel-agent_1.0.0_amd64.deb
echo "Package created: sentinel-agent_1.0.0_amd64.deb"
