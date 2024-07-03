import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import {Input} from "@/components/ui/input";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const PasswordInput = ({...props}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="relative">
      <Input
        type={showPassword ? 'text' : 'password'}
        required
        placeholder="Your password"
        {...props}
      />
      <div
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 cursor-pointer"
        onClick={togglePasswordVisibility}
      >
        {showPassword ? <FaEyeSlash /> : <FaEye />}
      </div>
    </div>
  );
};

export default PasswordInput;
