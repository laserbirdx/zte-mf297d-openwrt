![OpenWrt on ZTE MF297D](assets/banner.jpg)

# OpenWrt for ZTE MF297D

OpenWrt port for the ZTE MF297D 4G LTE-A Wi-Fi 6 router (Qualcomm IPQ5018).
Both radios, all four Gigabit Ethernet ports, the built-in LTE modem, buttons,
correct MAC addresses and persistent installation to NAND via sysupgrade all work.

Prebuilt images are on the [Releases](../../releases/latest) page.

> **Unofficial.** This board is not in upstream OpenWrt yet. Flashing replaces the
> vendor firmware. Take a full flash backup first (see below). You do this at your
> own risk.

## Hardware

| Component | Details |
|---|---|
| SoC | Qualcomm IPQ5018, dual Cortex-A53 @ 1.0 GHz (AP-MP03.3 reference design) |
| RAM | 512 MiB DDR3L (Winbond W632GU6NB-12) |
| Flash | 256 MiB SPI-NAND, FORESEE F35UQA002G (128 KiB eraseblock, 2 KiB page) |
| Wi-Fi | IPQ5018 2.4 GHz (HE40) + QCN6122 5 GHz (HE160) (802.11ax, `ath11k`) |
| Ethernet | 4x GbE (`lan1`..`lan4`). `gmac1` -> SGMII -> QCA8337 switch |
| LTE modem | internal ZTE Cat 12 LTE-A module, USB `19d2:1485` (QMI `cdc-wdm0` / `wwan0` + `ttyUSB0`..`ttyUSB2`) |
| SIM | 1x Nano-SIM (4FF) |
| LEDs | Power (`GPIO 35`), Wi-Fi, 4G Network, Signal bars (driven by the LTE module via AT commands) |
| Buttons | reset (GPIO 32), WPS (GPIO 38) |
| NFC | NXP NTAG 5 on I2C (`0x54` on `blsp1_i2c3`, GPIO 33 SCL / GPIO 34 SDA) |
| Serial | 115200 8N1, 1.8 V TTL, `ttyMSM0` (GPIO 20 RX / GPIO 21 TX) |
| Stock firmware | QSDK, Linux 4.4.60, U-Boot 2016.01 |

Calibration data lives in the `0:art` partition (IPQ5018 at `0x1000`, QCN6122 at
`0x26800`). The base MAC address is stored in the `mac` partition (`0x0`..`0x5`).

### Stock flash layout (`/proc/mtd`)

```text
dev:    size   erasesize  name
mtd0: 00080000 00020000 "0:sbl1"
mtd1: 00080000 00020000 "0:mibib"
mtd2: 00040000 00020000 "0:bootconfig"
mtd3: 00040000 00020000 "0:bootconfig1"
mtd4: 00100000 00020000 "0:qsee"
mtd5: 00100000 00020000 "0:qsee_1"
mtd6: 00040000 00020000 "0:devcfg"
mtd7: 00040000 00020000 "0:devcfg_1"
mtd8: 00040000 00020000 "0:cdt"
mtd9: 00040000 00020000 "0:cdt_1"
mtd10: 00080000 00020000 "0:appsblenv"
mtd11: 00140000 00020000 "0:appsbl"
mtd12: 00140000 00020000 "0:appsbl_1"
mtd13: 00100000 00020000 "0:art"
mtd14: 00080000 00020000 "0:training"
mtd15: 000a0000 00020000 "fota-flag"
mtd16: 00080000 00020000 "mac"
mtd17: 01400000 00020000 "cfg-param"
mtd18: 00600000 00020000 "log"
mtd19: 000a0000 00020000 "oops"
mtd20: 00800000 00020000 "web"
mtd21: 03a00000 00020000 "rootfs"
mtd22: 00a00000 00020000 "openwrt_data"
mtd23: 02340000 00020000 "data"
mtd24: 06c00000 00020000 "fota"
mtd25: 01818000 0001f000 "ubi_rootfs"
```

## Default configuration of the release image

| Setting | Value |
|---|---|
| `lan1`..`lan3` | LAN (`br-lan`), `192.168.1.1`, DHCP server |
| `lan4` | WAN, DHCP client |
| Login | `root`, **no password**. Set one on first login (`passwd` or LuCI) |
| Wi-Fi | **disabled** by default. Enable it in LuCI after setting a password |
| Web UI | LuCI |

## Serial console (UART)

U-Boot gives a console on the on-board 4-pin serial header.

- 115200 8N1, **1.8 V TTL** (do **not** use a 3.3 V / 5 V or RS-232 adapter without a 1.8 V level shifter).
- Connect GND, TX and RX only (TX to RX, RX to TX). Do not connect VCC.
- U-Boot: press any key during the autoboot countdown. The prompt is `IPQ5018#`.

## Installation

You need: a USB-TTL serial adapter, an Ethernet cable, and a TFTP server on your PC.

Plug the Ethernet cable into one of the LAN ports (`LAN1`..`LAN4`).

### 1. Boot the initramfs image from RAM

Put `openwrt-qualcommax-ipq50xx-zte_mf297d-initramfs-uImage.itb` in the TFTP
server root. Give the PC a static IP, e.g. `192.168.1.100/24`.

Interrupt autoboot in U-Boot and run:

```
setenv ipaddr 192.168.1.1
setenv serverip 192.168.1.100
tftpboot 0x44000000 openwrt-qualcommax-ipq50xx-zte_mf297d-initramfs-uImage.itb
bootm 0x44000000
```

Do **not** run `saveenv`. Nothing is written to flash at this step: if anything goes
wrong, power-cycle and the stock firmware boots again.

### 2. Back up the flash

OpenWrt is now running from RAM at `192.168.1.1`. Before writing anything, copy every
MTD partition to your PC. `0:art` (Wi-Fi calibration), `mac` (MAC address) and
`cfg-param` (NVRAM) are unique to your unit and cannot be recovered from anywhere else.

```sh
# on the PC
for i in $(seq 0 22); do
  ssh root@192.168.1.1 "cat /dev/mtd$i" > mtd$i.bin
done
ssh root@192.168.1.1 cat /proc/mtd > proc_mtd.txt
```

### 3. Install to flash

Copy the sysupgrade image to the device and flash it:

```sh
scp -O openwrt-qualcommax-ipq50xx-zte_mf297d-squashfs-sysupgrade.bin root@192.168.1.1:/tmp/
ssh root@192.168.1.1 sysupgrade -n /tmp/openwrt-qualcommax-ipq50xx-zte_mf297d-squashfs-sysupgrade.bin
```

The upgrade removes the OEM UBI volumes (`ubi_rootfs`, `wifi_fw`, `bt_fw`) and installs
OpenWrt into the `rootfs` UBI partition (`mtd21`). The device reboots into OpenWrt from flash.

Later upgrades are normal sysupgrades from LuCI or the command line.

### Going back to stock

Restore the `rootfs` partition from your backup in U-Boot (TFTP the backup into RAM, then
`nand erase` / `nand write` the partition). Without a backup there is no easy way back.

## 4G LTE modem and SMS

The built-in ZTE LTE-A modem is attached to the internal USB 3.0 bus (`19d2:1485`) and
exposes RNDIS (`usb0`), USB serial AT ports (`ttyUSB0`..`ttyUSB2`), and QMI (`cdc-wdm0` / `wwan0`).

### Required packages

Select the following packages in `make menuconfig` (or install them with `apk`):

```sh
apk update
apk add kmod-usb-net-qmi-wwan kmod-usb-serial-option kmod-usb-serial-qualcomm \
        modemmanager luci-proto-modemmanager uqmi luci-proto-qmi \
        sms-tool luci-app-sms-tool-js picocom
```

If `/dev/ttyUSB0`..`/dev/ttyUSB2` are not created automatically, bind `19d2:1485` to the
`option` driver:

```sh
echo "19d2 1485" > /sys/bus/usb-serial/drivers/option1/new_id
```

### Cellular WAN configuration

With **ModemManager** (`luci-proto-modemmanager`):

```sh
uci set network.wan=interface
uci set network.wan.proto='modemmanager'
uci set network.wan.device='/sys/devices/platform/soc@0/8a00000.usb/xhci-hcd.1.auto/usb2/2-1'
uci set network.wan.apn='internet'
uci set network.wan.auth='none'
uci set network.wan.iptype='ipv4v6'
uci commit network
/etc/init.d/network reload
```

Or with **`uqmi`** (`luci-proto-qmi`):

```sh
uci set network.wan=interface
uci set network.wan.proto='qmi'
uci set network.wan.device='/dev/cdc-wdm0'
uci set network.wan.apn='internet'
uci set network.wan.auth='none'
uci set network.wan.pdptype='ipv4v6'
uci commit network
/etc/init.d/network reload
```

### Signal status, AT commands and SMS (`sms_tool`)

```sh
sms_tool -d /dev/ttyUSB1 status
sms_tool -d /dev/ttyUSB1 at "AT+COPS?"
sms_tool -d /dev/ttyUSB1 recv
```

## License

[GPL-2.0](LICENSE), the same as OpenWrt and the Linux kernel.
