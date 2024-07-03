import {useEffect, useState} from "react";

interface PasswordValidationProps {
  password: string;
  onValidated: (isValid: boolean) => void;
}

const PasswordValidation = ({password, onValidated}: PasswordValidationProps) => {
  const [validationCriteria, setValidationCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    digit: false,
    specialChar: false,
  });

  useEffect(() => {
    validatePassword(password);
  }, [password])

  const validatePassword = (password: string) => {
    const criteria = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      digit: /[0-9]/.test(password),
      specialChar: /[!@#$%^&*]/.test(password),
    };
    setValidationCriteria(criteria);
    const isValid = criteria.length && criteria.uppercase && criteria.lowercase && criteria.digit && criteria.specialChar;
    onValidated(isValid);
  };

  return (
    <div className="mt-2">
      <ul className="text-sm font-medium">
        <li className={validationCriteria.length ? 'text-green-500' : 'text-red-500'}>
          {validationCriteria.length ? '✓' : '✗'} Password must be at least 8 characters long
        </li>
        <li className={validationCriteria.uppercase ? 'text-green-500' : 'text-red-500'}>
          {validationCriteria.uppercase ? '✓' : '✗'} Password must contain at least one uppercase letter
        </li>
        <li className={validationCriteria.lowercase ? 'text-green-500' : 'text-red-500'}>
          {validationCriteria.lowercase ? '✓' : '✗'} Password must contain at least one lowercase letter
        </li>
        <li className={validationCriteria.digit ? 'text-green-500' : 'text-red-500'}>
          {validationCriteria.digit ? '✓' : '✗'} Password must contain at least one digit
        </li>
        <li className={validationCriteria.specialChar ? 'text-green-500' : 'text-red-500'}>
          {validationCriteria.specialChar ? '✓' : '✗'} Password must contain at least one special character
        </li>
      </ul>
    </div>
  );
}

export default PasswordValidation;
