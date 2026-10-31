import { useState } from "react"

/** Local SVGs avoid relying on the operating system's flag emoji font. */
export function CountryFlag({ country = "" }: { country?: string }) {
  const code = country.trim().toLowerCase()
  const [failed, setFailed] = useState("")
  if (!/^[a-z]{2}$/.test(code)) return null
  if (failed === code) return <span className="flag-code">{code.toUpperCase()}</span>

  return (
    <img
      className="flag"
      src={`/flags/${code}.svg`}
      alt={code.toUpperCase()}
      title={code.toUpperCase()}
      width={20}
      height={15}
      onError={() => setFailed(code)}
    />
  )
}