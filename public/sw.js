/* eslint-disable */
// Service worker for Web Push.
// Registers itself, listens for push events, displays notifications.

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload = { title: "4x Journal", body: "You have a new alert", url: "/dashboard" }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch (e) {
    if (event.data) payload.body = event.data.text()
  }
  const options = {
    body: payload.body,
    data: { url: payload.url },
    icon: "/icon.png",
    badge: "/icon.png",
    tag: payload.tag || "4x-journal",
    renotify: !!payload.renotify,
  }
  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
