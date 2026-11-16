'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('nfc'),
			uci.load('wireless'),
			fs.exec('/usr/bin/nfc-wifi-sync', ['--dump']).catch(function(err) {
				return { code: 1, stdout: 'CHIP_STATUS=ERROR\n' + (err.message || '') };
			})
		]);
	},

	render: function(data) {
		var dumpOut = (data[2] && data[2].stdout) ? data[2].stdout : '';
		var lines = dumpOut.trim().split('\n');
		var chipStatus = 'Bilinmiyor';
		var activeMode = 'wifi';
		var lastSync = '-';
		var eepromLines = [];

		for (var i = 0; i < lines.length; i++) {
			if (lines[i].indexOf('CHIP_STATUS=') === 0)
				chipStatus = lines[i].substring(12);
			else if (lines[i].indexOf('ACTIVE_MODE=') === 0)
				activeMode = lines[i].substring(12);
			else if (lines[i].indexOf('LAST_SYNC=') === 0)
				lastSync = lines[i].substring(10);
			else if (lines[i].indexOf('Block ') === 0)
				eepromLines.push(lines[i]);
		}

		var isOnline = chipStatus.indexOf('ONLINE') === 0;
		var m, s, o;

		m = new form.Map('nfc', _('ZTE MF297D — NFC Etiketi (NXP NTAG 5)'),
			_('Cihazın ön yüzündeki yerleşik NXP NTAG 5 (I2C-0 @ 0x54) NFC çipini buradan yönetebilirsiniz. Wi-Fi tek dokunuşla bağlantı (WFA WSC), Web Sitesi/Telegram URL, Canlı 4G & Sistem Özeti veya Dijital Kartvizit (vCard) yazdırabilirsiniz.'));

		s = m.section(form.NamedSection, 'main', 'nfc', _('Donanım Durumu ve Hızlı İşlemler'));
		s.anonymous = false;

		o = s.option(form.DummyValue, '_status', _('Çip Durumu'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var badgeColor = isOnline ? '#00d26a' : '#ff4d4f';
			var html = '<div style="line-height:1.8;">' +
				'<b>Donanım:</b> <span style="color:' + badgeColor + ';font-weight:bold;">' + chipStatus + '</span><br/>' +
				'<b>Aktif Mod:</b> <code>' + activeMode + '</code><br/>' +
				'<b>Son Yazılan Veri:</b> <span>' + lastSync + '</span>';
			if (eepromLines.length > 0) {
				html += '<details style="margin-top:6px;"><summary style="cursor:pointer;color:#389e0d;"><b>EEPROM Bellek Dökümü (Block 00..07)</b></summary>' +
					'<pre style="margin:6px 0;padding:8px;background:#141414;color:#00d26a;border-radius:4px;font-size:12px;">' +
					eepromLines.join('\n') + '</pre></details>';
			}
			html += '</div>';
			return html;
		};

		o = s.option(form.Button, '_sync_now', _('Manuel Senkronizasyon'));
		o.inputtitle = _('Şimdi Etikete Yaz (Sync Now)');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return uci.save().then(function() {
				return uci.apply();
			}).then(function() {
				return fs.exec('/usr/bin/nfc-wifi-sync');
			}).then(function(res) {
				ui.addNotification(null, E('p', _('NFC etiketine başarıyla yazıldı: ') + (res.stdout || 'OK')), 'info');
				window.setTimeout(function() { location.reload(); }, 800);
			});
		};

		o = s.option(form.Button, '_reset_wifi', _('Orijinal Moda Döndür'));
		o.inputtitle = _('Wi-Fi Moduna Döndür ve Yaz');
		o.inputstyle = 'reset';
		o.onclick = function() {
			return fs.exec('/usr/bin/nfc-wifi-sync', ['--wifi']).then(function(res) {
				ui.addNotification(null, E('p', _('NFC etiketi orijinal Wi-Fi moduna döndürüldü: ') + (res.stdout || 'OK')), 'info');
				window.setTimeout(function() { location.reload(); }, 800);
			});
		};

		s = m.section(form.NamedSection, 'main', 'nfc', _('NFC Etiket Yapılandırması'));

		o = s.option(form.Flag, 'enabled', _('NFC Senkronizasyonu Aktif'),
			_('Açılışta ve Wi-Fi ayarları değiştiğinde NFC etiketini otomatik günceller.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('NFC Çalışma Modu'),
			_('Telefonu cihazın üzerindeki NFC logosuna yaklaştırdığınızda tetiklenecek içerik türü.'));
		o.value('wifi', _('Wi-Fi Otomatik Bağlantı (Orijinal WFA WSC Modu)'));
		o.value('url', _('Web Sitesi / Telegram / Link (NDEF URI)'));
		o.value('status', _('Canlı 4G LTE + Sistem + Son SMS Özeti (NDEF Text)'));
		o.value('vcard', _('Dijital Kartvizit (vCard / Rehbere Ekle)'));
		o.value('text', _('Serbest Metin / Not (NDEF Text)'));
		o.default = 'wifi';

		/* Wi-Fi Mode Options */
		o = s.option(form.ListValue, 'wifi_iface', _('Paylaşılacak Wi-Fi Ağı'),
			_('UCI kablosuz ağlarından otomatik SSID ve şifre okunur.'));
		o.depends('mode', 'wifi');
		o.value('default_radio1', _('5 GHz Wi-Fi 6 Ağı (default_radio1 — Önerilen)'));
		o.value('default_radio0', _('2.4 GHz Wi-Fi 6 Ağı (default_radio0)'));
		o.value('custom', _('Özel SSID ve Şifre Gir'));
		o.default = 'default_radio1';

		o = s.option(form.Value, 'custom_ssid', _('Özel Wi-Fi SSID'));
		o.depends({ mode: 'wifi', wifi_iface: 'custom' });
		o.placeholder = 'ZTE MF297D';

		o = s.option(form.ListValue, 'custom_enc', _('Şifreleme Türü'));
		o.depends({ mode: 'wifi', wifi_iface: 'custom' });
		o.value('psk2', _('WPA2-PSK / WPA3-SAE (AES)'));
		o.value('psk-mixed', _('WPA/WPA2 Karışık'));
		o.value('none', _('Şifresiz (Açık Ağ)'));
		o.default = 'psk2';

		o = s.option(form.Value, 'custom_key', _('Wi-Fi Şifresi'));
		o.depends({ mode: 'wifi', wifi_iface: 'custom', custom_enc: 'psk2' });
		o.depends({ mode: 'wifi', wifi_iface: 'custom', custom_enc: 'psk-mixed' });
		o.password = true;

		/* URL Mode Options */
		o = s.option(form.Value, 'url', _('Hedef URL / Web Sitesi Adresi'),
			_('Telefon yaklaştırıldığında doğrudan tarayıcıda veya uygulamada açılacak adres.'));
		o.depends('mode', 'url');
		o.placeholder = 'https://t.me/LaserbirdsLogs';

		/* vCard Mode Options */
		o = s.option(form.Value, 'vcard_name', _('Kartvizit İsim / Unvan'));
		o.depends('mode', 'vcard');
		o.placeholder = 'Omer (laserbirdx)';

		o = s.option(form.Value, 'vcard_url1', _('1. Bağlantı (Telegram / Web)'));
		o.depends('mode', 'vcard');
		o.placeholder = 'https://t.me/LaserbirdsLogs';

		o = s.option(form.Value, 'vcard_url2', _('2. Bağlantı (GitHub / Sosyal)'));
		o.depends('mode', 'vcard');
		o.placeholder = 'https://github.com/laserbirdx';

		o = s.option(form.Value, 'vcard_note', _('Kartvizit Notu'));
		o.depends('mode', 'vcard');
		o.placeholder = 'Embedded Linux | OpenWrt | 5G/LTE';

		/* Custom Text Mode Options */
		o = s.option(form.Value, 'text', _('Etiket Metni (Maks. 200 Karakter)'));
		o.depends('mode', 'text');
		o.placeholder = 'ZTE MF297D OpenWrt';

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			return fs.exec('/usr/bin/nfc-wifi-sync');
		}).then(function() {
			window.setTimeout(function() { location.reload(); }, 600);
		});
	}
});
