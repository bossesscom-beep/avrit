package `in`.bighelpers.avrit

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject

object ReminderScheduler {
    private const val CHANNEL = "avrit-care"
    private fun prefs(context: Context) = context.getSharedPreferences("avrit-reminders", Context.MODE_PRIVATE)
    private fun stored(context: Context): JSONObject = try { JSONObject(prefs(context).getString("items", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    private fun save(context: Context, items: JSONObject) {
        check(prefs(context).edit().putString("items", items.toString()).commit()) { "Could not save scheduled reminders." }
    }
    fun channel(context: Context) {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "Avrit care reminders", NotificationManager.IMPORTANCE_DEFAULT)
        )
    }
    fun allowed(context: Context): Boolean {
        channel(context)
        return NotificationManagerCompat.from(context).areNotificationsEnabled() &&
            context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL).importance != NotificationManager.IMPORTANCE_NONE
    }
    private fun alarmIntent(context: Context, id: String, at: Long): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).setAction("in.bighelpers.avrit.REMIND")
            .setData(Uri.parse("avrit://reminder/" + Uri.encode(id))).putExtra("id", id).putExtra("at", at)
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    private fun schedule(context: Context, id: String, item: JSONObject) {
        if (item.optBoolean("delivered")) return
        context.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, maxOf(item.getLong("fireAt"), System.currentTimeMillis() + 1000), alarmIntent(context, id, item.getLong("at"))
        )
    }
    @Synchronized fun sync(context: Context, requested: JSONArray): Int {
        val old = stored(context)
        val next = JSONObject()
        if (allowed(context)) for (index in 0 until minOf(requested.length(), 60)) {
            val item = requested.getJSONObject(index)
            val id = item.getString("id")
            val at = item.getLong("at")
            if (at <= 0) continue
            val previous = old.optJSONObject(id)
            val entry = if (previous?.optLong("at") == at) previous else JSONObject()
                .put("at", at).put("fireAt", maxOf(at, System.currentTimeMillis() + 60000)).put("delivered", false)
            entry.put("title", item.getString("title").take(100))
            next.put(id, entry)
        }
        // Persist before installing alarms so a fired receiver always sees its matching schedule.
        save(context, next)
        for (id in old.keys()) if (!next.has(id) || old.getJSONObject(id).getLong("at") != next.getJSONObject(id).getLong("at")) {
            context.getSystemService(AlarmManager::class.java).cancel(alarmIntent(context, id, old.getJSONObject(id).getLong("at")))
            NotificationManagerCompat.from(context).cancel(id, 1)
        }
        var count = 0
        for (id in next.keys()) {
            val item = next.getJSONObject(id)
            schedule(context, id, item)
            if (!item.optBoolean("delivered")) count++
        }
        return count
    }
    @Synchronized fun restore(context: Context) {
        if (!allowed(context)) return
        val items = stored(context)
        for (id in items.keys()) schedule(context, id, items.getJSONObject(id))
    }
    fun test(context: Context) {
        check(allowed(context)) { "Allow notifications in device settings first." }
        show(context, "avrit-test", "A little care, on repeat.", "Your Avrit test notification is here.")
    }
    @Synchronized fun deliver(context: Context, id: String, at: Long) {
        val items = stored(context)
        val item = items.optJSONObject(id) ?: return
        if (item.optLong("at") != at || item.optBoolean("delivered") || !allowed(context)) return
        show(context, id, item.getString("title"), "A little care when you can. Open Avrit to log it or adjust your rhythm.")
        item.put("delivered", true)
        save(context, items)
    }
    @Suppress("MissingPermission")
    private fun show(context: Context, id: String, title: String, body: String) {
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        NotificationManagerCompat.from(context).notify(id, 1, NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(title).setContentText(body)
            .setContentIntent(open).setAutoCancel(true).build())
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            when (intent.action) {
                Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> ReminderScheduler.restore(context)
                "in.bighelpers.avrit.REMIND" -> ReminderScheduler.deliver(context, intent.getStringExtra("id") ?: return, intent.getLongExtra("at", 0))
            }
        } catch (_: Exception) { /* Keep saved schedules for the next app-open or boot retry. */ }
    }
}
