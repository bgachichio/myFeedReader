// Average adult reading speed: 238 words per minute
const WPM = 238

export function estimateReadingTime(text = '') {
  if (!text) return null
  const words = text.trim().split(/\s+/).length
  const minutes = Math.ceil(words / WPM)
  return minutes < 1 ? 1 : minutes
}

export function formatReadingTime(minutes) {
  if (!minutes) return null
  return `${minutes} min read`
}
