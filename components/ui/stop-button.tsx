import {Button, ButtonProps} from "@/components/ui/button";

export type StopButtonProps = ButtonProps & {
  onStopClicked: () => void;
}

export const StopButton = ({onStopClicked, ...props}: StopButtonProps) => {
  return (
    <Button
      size={'icon'}
      variant={'ghost'}
      onClick={onStopClicked}
      {...props}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="absolute flex items-center justify-center w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        <div className="w-2 h-2 bg-white !animate-none"/>
      </div>
    </Button>
  );
}
