# Requirements

- MongoDB
- NodeJS
- Git

# Setting up

## MongoDB
```
apt update
apt install mongodb
systemctl enable --now mongodb
```

## Kompakkt

#### Cloning and installing
```
git clone https://github.com/DH-Cologne/Kompakkt.git
git checkout demo
cd Kompakkt
npm i
```

## ObjectsRepositoryServer

#### Cloning and installing
```
git clone https://github.com/DH-Cologne/ObjectsRepositoryServer.git
git checkout demo
cd ObjectsRepositoryServer
npm i
npm run build

```

#### SystemD service
Save as e.g. ObjectsRepositoryServer.service in the systemd service directory
Ubuntu 18.04 LTS - /etc/systemd/system/ObjectsRepositoryServer.service
```
[Unit]
Description=NodeJS ExpressJS ObjectsRepositoryServer
Wants=network.target
After=network.target

[Service]
User=root
Group=root
ExecStart=/usr/bin/node /opt/ObjectsRepositoryServer/dist/server.js

[Install]
WantedBy=multi-user.target
```

Start and enable the service by executing
```
systemctl enable --now ObjectsRepositoryServer.service
```
