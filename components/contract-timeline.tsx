import React from "react";
import {format} from "date-fns";
import {fr} from "date-fns/locale";

interface ContractTimelineProps {
  notificationDate: Date;
  advanceNoticeInMonths: number;
  contractEndDate: Date;
}

export const ContractTimeline: React.FC<ContractTimelineProps> = (
  {
    notificationDate,
    advanceNoticeInMonths,
    contractEndDate
  }) => {
  const steps = [
    {
      label: "📅 Notification",
      date: notificationDate,
      description: "Date de notification du licenciement",
    },
    {
      label: "⏳ Préavis",
      date: new Date(notificationDate.getFullYear(), notificationDate.getMonth() + advanceNoticeInMonths, notificationDate.getDate()),
      description: `${advanceNoticeInMonths} mois de préavis`,
    },
    {
      label: "🏁 Fin de contrat",
      date: contractEndDate,
      description: "Date estimée de fin de contrat",
    },
  ];

  return (
    <div className="border p-4 rounded-md shadow bg-white mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">🕒 Timeline de fin de contrat</h3>
      <ol className="relative border-l border-gray-300 ml-2 space-y-4">
        {steps.map((step, index) => (
          <li key={index} className="ml-6">
            <div className="absolute w-3 h-3 bg-blue-600 rounded-full -left-1.5 border border-white"></div>
            <time className="block text-sm text-gray-500">
              {format(step.date, "dd MMMM yyyy", {locale: fr})}
            </time>
            <h4 className="text-md font-medium text-gray-900">{step.label}</h4>
            <p className="text-sm text-gray-600">{step.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
};
