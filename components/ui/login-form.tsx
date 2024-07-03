import * as Form from "@radix-ui/react-form";
import {Input} from "@/components/ui/input";
import PasswordInput from "@/components/password-input";
import PasswordValidation from "@/components/password-validation";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import React, {useState} from "react";
import {FormProps} from "@radix-ui/react-form";

type LoginFormProps = FormProps & React.RefAttributes<HTMLFormElement> & {
  loading: boolean;
  mode?: "signup" | "login";
}

export const LoginForm = ({loading, mode = "login", ...props}: LoginFormProps) => {
  const [password, setPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  return (
    <Form.Root className="flex flex-col mt-6" {...props} method="post">
      <div className="space-y-4">
        <Form.Field name="email" className="space-y-2">
          <Form.Label className="font-medium text-base">Email</Form.Label>
          <Form.Control asChild>
            <Input required placeholder="Your email address" type="email"/>
          </Form.Control>
          <div className="flex flex-col">
            <Form.Message className="text-sm text-red-500 font-medium" match="valueMissing">
              {"Please enter your email"}
            </Form.Message>
            <Form.Message className="text-sm text-red-500 font-medium" match="typeMismatch">
              {"Please provide a valid email"}
            </Form.Message>
          </div>
        </Form.Field>
        <Form.Field name="password" className="space-y-2">
          <h4 className="font-medium text-base">{"Password"}</h4>
          <span className="text-sm text-red-500 font-medium"></span>
          <Form.Control asChild>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)}/>
          </Form.Control>
          {password.length > 0 && mode === "signup" && (
            <PasswordValidation password={password} onValidated={(isValid) => setIsPasswordValid(isValid)} />
          )}
        </Form.Field>
      </div>
      <Form.Submit asChild disabled={loading || password.length <= 2 || (mode === "signup" && !isPasswordValid)}>
        <Button
          variant={'default'}
          className="mt-8"
        >
          {loading ? <Spinner/> : "Continue"}
        </Button>
      </Form.Submit>
    </Form.Root>
  );
}
