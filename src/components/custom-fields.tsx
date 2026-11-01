"use client";

import { useEffect, useState } from "react";
import { loadCustomFields } from "@/app/actions/apps";
import { fieldClass, labelClass } from "@/components/erp-ui";

export function CustomFields({
  entityType,
  initial,
  onChange,
}: {
  entityType: "PRODUCT" | "CUSTOMER" | "SUPPLIER" | "INVOICE";
  initial?: Record<string, string>;
  onChange?: (data: Record<string, string>) => void;
}) {
  const [fields, setFields] = useState<Array<{ id: string; fieldName: string; fieldType: string; options: string }>>([]);
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});

  useEffect(() => {
    let live = true;
    loadCustomFields(entityType).then((rows) => {
      if (live) setFields(rows);
    });
    return () => {
      live = false;
    };
  }, [entityType]);

  function update(name: string, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    onChange?.(next);
  }

  if (fields.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.id}>
          <label className={labelClass}>{field.fieldName}</label>
          {field.fieldType === "SELECT" ? (
            <select
              name={`custom__${field.fieldName}`}
              className={fieldClass}
              value={values[field.fieldName] ?? ""}
              onChange={(event) => update(field.fieldName, event.target.value)}
            >
              <option value="">اختر</option>
              {field.options
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean)
                .map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </select>
          ) : (
            <input
              name={`custom__${field.fieldName}`}
              type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
              className={fieldClass}
              value={values[field.fieldName] ?? ""}
              onChange={(event) => update(field.fieldName, event.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
