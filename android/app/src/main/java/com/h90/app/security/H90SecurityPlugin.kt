package com.h90.app.security

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Debug
import android.provider.Settings
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.NetworkInterface
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@CapacitorPlugin(name = "H90Security")
class H90SecurityPlugin : Plugin() {

    companion object {
        // ⚠️ ضع هنا SHA-1 و SHA-256 الخاصين بمفتاح التوقيع الذي ستستخدمه
        // إذا لم يكن لديك مفتاح، استخدم القيم الحالية مؤقتاً
        private const val EXPECTED_SHA1 = "4140C8319C3B0ED361245373EBD33BA106081B5A"
        private const val EXPECTED_SHA256 = "5ED5B3494642FA161605D623D71706798122CF038BEE104F1762D31306DC5EBB"
        private const val MASTER_SECRET_KEY = "h90_master_secret_v6_2026"
    }

    private val blockedPackages = listOf(
        "com.topjohnwu.magisk", "de.robv.android.xposed", "de.robv.android.xposed.installer",
        "com.saurik.substrate", "re.frida.server", "org.frida.server",
        "com.guoshi.httpcanary", "com.guoshi.httpcanary.premium", "com.xk72.charlesproxy",
        "com.telerik.fiddler", "org.wireshark", "com.portswigger.burp",
        "com.bluestacks", "com.bignox.app", "com.genymotion.superuser",
        "com.ldplayer.app", "com.chelpus.luckypatcher", "com.dimonvideo.luckypatcher",
        "bin.mt.plus", "com.mt.mtmanage", "com.apkeditor.pro",
        "com.jrummy.apps.build.prop.editor"
    )

    @PluginMethod
    fun isNative(call: PluginCall) {
        val result = JSObject()
        result.put("native", true)
        call.resolve(result)
    }

    @PluginMethod
    fun verifySignature(call: PluginCall) {
        val result = JSObject()
        try {
            val pm = context.packageManager
            val packageName = context.packageName
            val signatures = pm.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNATURES).signatures

            for (sig in signatures) {
                val md = MessageDigest.getInstance("SHA-1")
                md.update(sig.toByteArray())
                val sha1 = md.digest().joinToString("") { "%02X".format(it) }

                val md256 = MessageDigest.getInstance("SHA-256")
                md256.update(sig.toByteArray())
                val sha256 = md256.digest().joinToString("") { "%02X".format(it) }

                if (sha1.equals(EXPECTED_SHA1, ignoreCase = true) ||
                    sha256.equals(EXPECTED_SHA256, ignoreCase = true)) {
                    result.put("valid", true)
                    result.put("sha1", sha1)
                    result.put("sha256", sha256)
                    call.resolve(result)
                    return
                }
            }
            result.put("valid", false)
            result.put("reason", "signature_mismatch")
            call.resolve(result)
        } catch (e: Exception) {
            result.put("valid", false)
            result.put("error", e.message)
            call.resolve(result)
        }
    }

    @PluginMethod
    fun isVerified(call: PluginCall) {
        val result = JSObject()
        try {
            val pm = context.packageManager
            val packageName = context.packageName
            val signatures = pm.getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNATURES).signatures
            for (sig in signatures) {
                val md = MessageDigest.getInstance("SHA-1")
                md.update(sig.toByteArray())
                val sha1 = md.digest().joinToString("") { "%02X".format(it) }
                if (sha1.equals(EXPECTED_SHA1, ignoreCase = true)) {
                    result.put("valid", true)
                    call.resolve(result)
                    return
                }
            }
            result.put("valid", false)
            call.resolve(result)
        } catch (e: Exception) {
            result.put("valid", false)
            call.resolve(result)
        }
    }

    @PluginMethod
    fun getMasterSecret(call: PluginCall) {
        val result = JSObject()
        try {
            val secret = generateMasterSecret()
            result.put("secret", secret)
            call.resolve(result)
        } catch (e: Exception) {
            result.put("secret", "")
            call.resolve(result)
        }
    }

    @PluginMethod
    fun isRooted(call: PluginCall) {
        val result = JSObject()
        result.put("rooted", checkRoot())
        call.resolve(result)
    }

    @PluginMethod
    fun isFridaDetected(call: PluginCall) {
        val result = JSObject()
        result.put("detected", checkFrida())
        call.resolve(result)
    }

    @PluginMethod
    fun isXposedDetected(call: PluginCall) {
        val result = JSObject()
        result.put("detected", checkXposed())
        call.resolve(result)
    }

    @PluginMethod
    fun isEmulator(call: PluginCall) {
        val result = JSObject()
        result.put("emulator", checkEmulator())
        call.resolve(result)
    }

    @PluginMethod
    fun isVPNConnected(call: PluginCall) {
        val result = JSObject()
        result.put("vpn", checkVPN())
        call.resolve(result)
    }

    @PluginMethod
    fun isProxyEnabled(call: PluginCall) {
        val result = JSObject()
        result.put("proxy", checkProxy())
        call.resolve(result)
    }

    @PluginMethod
    fun isScreenRecording(call: PluginCall) {
        val result = JSObject()
        result.put("recording", checkScreenRecording())
        call.resolve(result)
    }

    @PluginMethod
    fun isDebuggerAttached(call: PluginCall) {
        val result = JSObject()
        result.put("attached", Debug.isDebuggerConnected() || Debug.waitingForDebugger())
        call.resolve(result)
    }

    @PluginMethod
    fun isAppInstalled(call: PluginCall) {
        val result = JSObject()
        val pkg = call.getString("package") ?: ""
        result.put("installed", isPackageInstalled(pkg))
        call.resolve(result)
    }

    @PluginMethod
    fun isUsbDebuggingEnabled(call: PluginCall) {
        val result = JSObject()
        val enabled = try {
            Settings.Global.getInt(context.contentResolver, Settings.Global.ADB_ENABLED, 0) == 1
        } catch (e: Exception) { false }
        result.put("enabled", enabled)
        call.resolve(result)
    }

    @PluginMethod
    fun exitApp(call: PluginCall) {
        try {
            activity?.finishAffinity()
            System.exit(0)
        } catch (e: Exception) {}
        call.resolve()
    }

    private fun checkRoot(): Boolean {
        val suPaths = arrayOf(
            "/system/app/Superuser.apk", "/sbin/su", "/system/bin/su", "/system/xbin/su",
            "/data/local/xbin/su", "/data/local/bin/su", "/system/sd/xbin/su",
            "/system/bin/failsafe/su", "/data/local/su", "/su/bin/su",
            "/system/xbin/daemonsu", "/system/etc/init.d/99SuperSUDaemon"
        )
        for (path in suPaths) if (File(path).exists()) return true
        val tags = Build.TAGS
        if (tags != null && tags.contains("test-keys")) return true
        for (pkg in blockedPackages) if (isPackageInstalled(pkg)) return true
        if (Debug.isDebuggerConnected()) return true
        return false
    }

    private fun checkFrida(): Boolean {
        try {
            val ports = intArrayOf(27042, 27043, 27044, 27045)
            for (port in ports) {
                try {
                    val socket = java.net.Socket("127.0.0.1", port)
                    socket.close()
                    return true
                } catch (e: Exception) {}
            }
        } catch (e: Exception) {}
        try {
            val proc = Runtime.getRuntime().exec("ps -A")
            val reader = BufferedReader(InputStreamReader(proc.inputStream))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                if (line!!.contains("frida") || line!!.contains("gadget")) return true
            }
        } catch (e: Exception) {}
        val fridaLibs = arrayOf(
            "/data/local/tmp/frida-server", "/data/local/tmp/re.frida.server",
            "/data/local/tmp/frida-gadget.so"
        )
        for (lib in fridaLibs) if (File(lib).exists()) return true
        return false
    }

    private fun checkXposed(): Boolean {
        try {
            throw Exception("Xposed")
        } catch (e: Exception) {
            for (element in e.stackTrace) {
                if (element.className.contains("de.robv.android.xposed")) return true
            }
        }
        val xposedPaths = arrayOf(
            "/system/framework/XposedBridge.jar",
            "/system/lib/libxposed_art.so",
            "/system/lib64/libxposed_art.so"
        )
        for (path in xposedPaths) if (File(path).exists()) return true
        return false
    }

    private fun checkEmulator(): Boolean {
        val fp = Build.FINGERPRINT
        val model = Build.MODEL
        val manufacturer = Build.MANUFACTURER
        val product = Build.PRODUCT
        val hardware = Build.HARDWARE

        if (fp.startsWith("generic") || fp.startsWith("unknown") ||
            model.contains("google_sdk") || model.contains("Emulator") ||
            model.contains("Android SDK built for x86") || manufacturer.contains("Genymotion") ||
            hardware.contains("goldfish") || hardware.contains("ranchu") ||
            product.contains("sdk") || product.contains("emulator") || product.contains("simulator")
        ) return true

        val emulatorFiles = arrayOf(
            "/dev/socket/qemud", "/dev/qemu_pipe",
            "/system/lib/libc_malloc_debug_qemu.so", "/sys/qemu_trace",
            "/system/bin/qemu-props"
        )
        for (file in emulatorFiles) if (File(file).exists()) return true
        return false
    }

    private fun checkVPN(): Boolean {
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = cm.activeNetwork ?: return false
                val caps = cm.getNetworkCapabilities(network) ?: return false
                return caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
            } else {
                @Suppress("DEPRECATION")
                val networks = cm.allNetworks
                for (network in networks) {
                    @Suppress("DEPRECATION")
                    val caps = cm.getNetworkCapabilities(network)
                    if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return true
                }
            }
        } catch (e: Exception) {}
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                val name = iface.name.lowercase()
                if (name.startsWith("tun") || name.startsWith("tap") || name.contains("ppp") || name.contains("vpn")) return true
            }
        } catch (e: Exception) {}
        try {
            val proxyHost = System.getProperty("http.proxyHost")
            if (proxyHost != null && proxyHost.isNotEmpty()) return true
        } catch (e: Exception) {}
        return false
    }

    private fun checkProxy(): Boolean {
        return try {
            val proxyHost = System.getProperty("http.proxyHost")
            proxyHost != null && proxyHost.isNotEmpty()
        } catch (e: Exception) { false }
    }

    private fun checkScreenRecording(): Boolean {
        try {
            val proc = Runtime.getRuntime().exec("ps -A")
            val reader = BufferedReader(InputStreamReader(proc.inputStream))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                val l = line!!.lowercase()
                if (l.contains("screenrecord") || l.contains("screencap") ||
                    l.contains("mediaprojection") || l.contains("az screen")) return true
            }
        } catch (e: Exception) {}
        return false
    }

    private fun isPackageInstalled(pkg: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(pkg, 0)
            true
        } catch (e: Exception) { false }
    }

    private fun generateMasterSecret(): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        val packageName = context.packageName
        val raw = "$androidId|$packageName|$MASTER_SECRET_KEY"
        val mac = Mac.getInstance("HmacSHA256")
        val keySpec = SecretKeySpec(MASTER_SECRET_KEY.toByteArray(), "HmacSHA256")
        mac.init(keySpec)
        val hmac = mac.doFinal(raw.toByteArray())
        return Base64.encodeToString(hmac, Base64.NO_WRAP)
    }
}