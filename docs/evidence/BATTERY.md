# Battery test (Q2)

Goal: measure battery use over a one-hour simulated round and report the number as an estimate, not a promise.

1. Charge the phone to 100%, set brightness to 50%, close other apps, keep Wi-Fi and mobile data as they would be on course.
2. Build the release app and install it. Start the simulation walk with live GPS on.
3. Reset the counters: `adb shell dumpsys batterystats --reset`.
4. Unplug the cable (or `adb shell dumpsys battery unplug` for a USB-connected run). Note the start level from `adb shell dumpsys battery`.
5. Leave the screen on and run the walk for 60 minutes. Score a few holes by hand during the hour.
6. Note the end level. Run `adb shell dumpsys batterystats <package name>` and write down the estimated power use for the app.
7. Restore the phone: `adb shell dumpsys battery reset`.
8. Report: start level, end level, percent used in one hour, estimated app power use, phone model, brightness, GPS mode. Extrapolate to 4.5 hours by multiplying and say it is an estimate.

Repeat once with the screen off between shots if the app supports it. Check the exact adb commands on the phone first, they vary by Android version.
