package `in`.bighelpers.avrit

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ReminderSchedulerTest {
    @Test fun alarmBroadcastDeliversWithoutAnOpenActivity() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        instrumentation.uiAutomation.grantRuntimePermission(context.packageName, android.Manifest.permission.POST_NOTIFICATIONS)
        val prefs = context.getSharedPreferences("avrit-reminders", android.content.Context.MODE_PRIVATE)
        val backup = prefs.getString("items", "{}") ?: "{}"
        val manager = context.getSystemService(NotificationManager::class.java)
        val at = System.currentTimeMillis() + 86400000
        try {
            ReminderScheduler.sync(context, JSONArray().put(JSONObject().put("id", "qa-alarm").put("title", "Avrit alarm delivery check").put("at", at)))
            // Android may batch an inexact alarm for an hour. Dispatch the registered
            // PendingIntent through Android to verify the real manifest/receiver path.
            val alarm = PendingIntent.getBroadcast(context, 0, Intent(context, ReminderReceiver::class.java)
                .setAction("in.bighelpers.avrit.REMIND").setData(Uri.parse("avrit://reminder/qa-alarm")),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
            assertNotNull("The scheduler must register the alarm PendingIntent", alarm)
            alarm.send()
            val deadline = System.currentTimeMillis() + 5000
            while (System.currentTimeMillis() < deadline && manager.activeNotifications.none { it.tag == "qa-alarm" }) Thread.sleep(250)
            assertTrue("The alarm broadcast should deliver through ReminderReceiver without launching an Activity", manager.activeNotifications.any { it.tag == "qa-alarm" })
            assertTrue(JSONObject(prefs.getString("items", "{}") ?: "{}").getJSONObject("qa-alarm").getBoolean("delivered"))
        } finally {
            ReminderScheduler.sync(context, JSONArray())
            prefs.edit().putString("items", backup).commit()
            ReminderScheduler.restore(context)
        }
    }

    @Test fun scheduleDeliverRescheduleAndCancel() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        instrumentation.uiAutomation.grantRuntimePermission(context.packageName, android.Manifest.permission.POST_NOTIFICATIONS)
        val prefs = context.getSharedPreferences("avrit-reminders", android.content.Context.MODE_PRIVATE)
        val backup = prefs.getString("items", "{}") ?: "{}"
        // This is a test install. Preserve any unrelated schedule if the test is rerun.
        val at = System.currentTimeMillis() + 86400000
        fun plan(time: Long) = JSONArray().put(JSONObject().put("id", "qa-reminder").put("title", "Avrit QA reminder").put("at", time))
        try {
            assertEquals(1, ReminderScheduler.sync(context, plan(at)))
            ReminderScheduler.deliver(context, "qa-reminder", at)
            val manager = context.getSystemService(NotificationManager::class.java)
            assertTrue(manager.activeNotifications.any { it.tag == "qa-reminder" })
            assertEquals(0, ReminderScheduler.sync(context, plan(at)))
            ReminderScheduler.restore(context)
            assertTrue(JSONObject(prefs.getString("items", "{}") ?: "{}").getJSONObject("qa-reminder").getBoolean("delivered"))
            assertEquals(1, ReminderScheduler.sync(context, plan(at + 86400000)))
            assertFalse(manager.activeNotifications.any { it.tag == "qa-reminder" })
            // A stale alarm must not deliver after its schedule changes.
            ReminderScheduler.deliver(context, "qa-reminder", at)
            assertFalse(manager.activeNotifications.any { it.tag == "qa-reminder" })
            assertEquals(0, ReminderScheduler.sync(context, JSONArray()))
        } finally {
            ReminderScheduler.sync(context, JSONArray())
            prefs.edit().putString("items", backup).commit()
            ReminderScheduler.restore(context)
        }
    }
}
