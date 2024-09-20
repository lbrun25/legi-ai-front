'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {useState} from "react";

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const [sunRotating, setSunRotating] = useState("")

  function startSunRotation() {
    if (window.ontouchstart === undefined) {
      console.log('start aniamtion')
      setSunRotating("animate-sun-rotation")
    }
  }

  function stopSunRotation() {
    if (window.ontouchstart === undefined) {
      setSunRotating("")
    }
  }

  function changeTheme() {
    if (theme == "light") {
      setTheme("dark")
    } else {
      setTheme("light")
    }
  }

  return (
    <Button
      onClick={changeTheme}
      variant="sidebar"
      size="sideBarIcon"
      onMouseOver={startSunRotation}
      onMouseLeave={stopSunRotation}
    >
      {
        theme == "dark" ?
          <Sun className={`${sunRotating} h-7 w-7`} /> :
          <Moon className="h-7 w-7" />
      }
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
