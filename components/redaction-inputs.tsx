import {ChangeEvent, FormEvent, useState} from "react";
import {Input} from "@/components/ui/input";
import * as React from "react";

interface RedactionInputsProps {
  fields: string[];
  onSubmit: (inputs: Record<string, string>) => void;
}

export const RedactionInputs = ({ fields, onSubmit }: RedactionInputsProps) => {
  const [formData, setFormData] = useState<Record<string, string>>(
    fields.reduce((acc: Record<string, string>, field) => {
      acc[field] = ''; // Initialize each field with an empty string
      return acc;
    }, {})
  );

  // Handle input change
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const {name, value} = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.map((field) => (
        <div key={field}>
          <label htmlFor={field}>{field}:</label>
          <Input
            type="text"
            name={field}
            value={formData[field]}
            className="pr-14 h-12"
            onChange={handleChange}
          />
        </div>
      ))}
      <button type="submit">Submit</button>
    </form>
  );
}
