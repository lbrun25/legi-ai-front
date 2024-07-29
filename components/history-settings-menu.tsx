import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {Button} from "@/components/ui/button";
import * as React from "react";
import {HiOutlineDotsHorizontal} from "react-icons/hi";

interface HistorySettingsMenuProps {
  onReportClicked: () => void;
  isReported: boolean;
  onOpenChanged: (isOpen: boolean) => void;
}

export function HistorySettingsMenu({onReportClicked, isReported, onOpenChanged}: HistorySettingsMenuProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChanged}>
      <DropdownMenuTrigger>
        <Button variant="link" size="icon">
          <HiOutlineDotsHorizontal className="h-4 w-4"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onReportClicked}>
          {isReported ? "Ne plus signaler" : "Signaler un problème"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
