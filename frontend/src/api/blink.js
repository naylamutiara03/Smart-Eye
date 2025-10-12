const API_BASE =
  process.env.REACT_APP_API_BASE || "http://localhost:5000"; // backend Flask

export async function stopDetection({ userId, deviceId, sessionId = null }) {
  const res = await fetch(`${API_BASE}/stop_detection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      device_id: deviceId,
      session_id: sessionId,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchHistory({ userId, deviceId, limit = 50 }) {
  const url = new URL(`${API_BASE}/history`);
  if (userId) url.searchParams.set("user_id", userId);
  if (deviceId) url.searchParams.set("device_id", deviceId);
  url.searchParams.set("limit", limit);
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
