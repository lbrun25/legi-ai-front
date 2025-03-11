import {Input} from "@/components/ui/input";
import React from "react";
import {SeniorityValueResponse} from "@/lib/types/bp";

interface EditIclDialogContentProps {
  referenceSalary: number;
  legalSeniority: Omit<SeniorityValueResponse, "formatted_duration">;
  conventionSeniority: Omit<SeniorityValueResponse, "formatted_duration">;
  legalAdvanceNotice: number;
  conventionAdvanceNotice: number;
  onChange: (field: string, value: number) => void;
}

export const EditIclDialogContent = (
  {
    referenceSalary,
    legalSeniority,
    conventionSeniority,
    legalAdvanceNotice,
    conventionAdvanceNotice,
    onChange,
  }: EditIclDialogContentProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-lg text-gray-800 mb-2">{"Salaire"}</h3>
        <label className="block text-sm font-medium text-gray-700">
          {"Salaire de référence"}
        </label>
        <Input
          type="number"
          name="referenceSalary"
          placeholder="Salaire de référence"
          value={referenceSalary}
          onChange={(e) => onChange("referenceSalary", Number(e.target.value))}
          className="pr-14 h-12"
        />
      </div>

      <div>
        <h3 className="font-medium text-lg text-gray-800 mb-2">{"Ancienneté Légal"}</h3>
        <label className="block text-sm font-medium text-gray-700">
          {"Nombre d'année"}
        </label>
        <div className="flex flex-row items-center space-x-4">
          <Input
            type="number"
            name="legalSeniorityTotalYears"
            placeholder="Nombre d'années"
            value={legalSeniority.total_years}
            onChange={(e) => onChange("legalSeniorityTotalYears", Number(e.target.value))}
            className="pr-14 h-12"
          />
          <span>{legalSeniority.total_years > 1 ? "ans" : "an"}</span>
        </div>
        <label className="block text-sm font-medium text-gray-700 mt-2">
          {"Nombre de mois"}
        </label>
        <div className="flex flex-row items-center space-x-4">
          <Input
            type="number"
            name="legalSeniorityTotalMonths"
            placeholder="Nombre de mois"
            value={legalSeniority.total_months}
            onChange={(e) => onChange("legalSeniorityTotalMonths", Number(e.target.value))}
            className="pr-14 h-12"
          />
          <span>{"mois"}</span>
        </div>
      </div>

      <div>
        <h3 className="font-medium text-lg text-gray-800 mb-2">{"Ancienneté Conventionnelle"}</h3>
        <label className="block text-sm font-medium text-gray-700">
          {"Nombre d'année"}
        </label>
        <div className="flex flex-row items-center space-x-4">
          <Input
            type="number"
            name="conventionSeniorityTotalYears"
            placeholder="Nombre d'années"
            value={conventionSeniority.total_years}
            onChange={(e) => onChange("conventionSeniorityTotalYears", Number(e.target.value))}
            className="pr-14 h-12"
          />
          <span>{conventionSeniority.total_years > 1 ? "ans" : "an"}</span>
        </div>
        <label className="block text-sm font-medium text-gray-700 mt-2">
          {"Nombre de mois"}
        </label>
        <div className="flex flex-row items-center space-x-4">
          <Input
            type="number"
            name="conventionSeniorityTotalMonths"
            placeholder="Nombre de mois"
            value={conventionSeniority.total_months}
            onChange={(e) => onChange("conventionSeniorityTotalMonths", Number(e.target.value))}
            className="pr-14 h-12"
          />
          <span>{"mois"}</span>
        </div>
      </div>

      <div>
        <h3 className="font-medium text-lg text-gray-800 mb-2">{"Préavis"}</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {"Préavis Légal"}
          </label>
          <div className="flex flex-row items-center space-x-4">
            <Input
              type="number"
              name="legalAdvanceNotice"
              placeholder="Préavis Légal"
              value={legalAdvanceNotice}
              onChange={(e) => onChange("legalAdvanceNotice", Number(e.target.value))}
              className="pr-14 h-12"
            />
            <span>{"mois"}</span>
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">
            {"Préavis Conventionnel"}
          </label>
          <div className="flex flex-row items-center space-x-4">
            <Input
              type="number"
              name="conventionAdvanceNotice"
              placeholder="Préavis Conventionnel"
              value={conventionAdvanceNotice}
              onChange={(e) => onChange("conventionAdvanceNotice", Number(e.target.value))}
              className="pr-14 h-12"
            />
            <span>{"mois"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
