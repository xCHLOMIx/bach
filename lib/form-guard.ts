import * as React from "react"

export function preventImplicitSubmitOnEnter(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter") {
    return
  }

  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }

  if (target.tagName === "TEXTAREA") {
    return
  }

  if (target.getAttribute("role") === "combobox") {
    return
  }

  event.preventDefault()
}
