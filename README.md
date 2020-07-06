# ws-miner

> Tunnel https?:// over wss?://

> :warning: Under heavy development. Won't work for you.

## Installation

```sh
yarn add ws-miner
```

## Usage

### On the egress server

```sh
# Assuming this is available under https://ws-miner.io:8080
$ ws-miner-server -p 8080
```

### On the exposing client

```sh
# Assuming something interesting runs on localhost:5000
$ ws-miner -u http://localhost:5000 -d wss://ws-miner.io:8080
https://ws-miner.io:8080/kVEpV3GRogKN7H9BXo7qu/
```

### On the accessing client

```sh
$ curl https://ws-miner.io:8080/kVEpV3GRogKN7H9BXo7qu/
```