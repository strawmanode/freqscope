/** Safari (desktop or iOS), excluding Chromium/Firefox/Edge/Opera shells that also report "Safari". */
export function isSafari(): boolean {
  const ua = navigator.userAgent
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR/i.test(ua)
}
