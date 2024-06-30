'use client'

import {Settings} from "lucide-react";
import * as React from "react";
import Link from "next/link";

export function SettingsButton() {
  // const [open, setOpen] = useState(false)

  return (
    // <>
    //   <DropdownMenu>
    //     <DropdownMenuTrigger asChild>
    //       <Button variant="ghost" size="icon" onClick="">
    //         <Settings className="h-[1.2rem] w-[1.2rem]"/>
    //         <span className="sr-only">Open settings</span>
    //       </Button>
    //     </DropdownMenuTrigger>
    //     <DropdownMenuContent align="end">
    //       <DropdownMenuItem onClick={() => setOpen(true)}>
    //         Admin
    //       </DropdownMenuItem>
    //     </DropdownMenuContent>
    //   </DropdownMenu>
    //   <Dialog
    //     open={open}
    //     onOpenChange={open => setOpen(open)}
    //     aria-labelledby="share-dialog-title"
    //     aria-describedby="share-dialog-description"
    //   >
    //     <AdminSettingsDialogContent/>
    //   </Dialog>
    // </>
    <Link
      href={"/settings"}
      className="flex items-center"
    >
      <Settings className="h-[1.2rem] w-[1.2rem]"/>
      <span className="sr-only">Open settings</span>
    </Link>
  )
}
