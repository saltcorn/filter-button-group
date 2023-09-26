const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const { eval_expression } = require("@saltcorn/data/models/expression");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const db = require("@saltcorn/data/db");
const {
  div,
  text,
  span,
  i,
  option,
  select,
  button,
  text_attr,
} = require("@saltcorn/markup/tags");
const {
  stateFieldsToWhere,
  readState,
} = require("@saltcorn/data/plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Buttons",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();

          return new Form({
            fields: [
              new FieldRepeat({
                name: "buttons",
                label: "Buttons",
                fields: [
                  { name: "label", label: "Label", type: "String" },
                  {
                    name: "state_formula",
                    label: "State formula",
                    class: "validate-expression",
                    sublabel:
                      'Formula for state object, e.g. <code>{a:1, b:"Hello"}</code>',
                    type: "String",
                  },
                ],
              }),
              {
                name: "horizontal",
                label: "Horizontal",
                type: "Bool",
              },
              {
                name: "spacing",
                label: "Spacing",
                type: "Integer",
                required: true,
                default: 2,
                attributes: {
                  max: 5,
                  min: 0,
                },
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = () => [];

const run = async (
  table_id,
  viewname,
  { buttons, horizontal, spacing },
  state,
  extra
) => {
  const table = await Table.findOne(table_id);
  const fields = await table.getFields();
  readState(state, fields);
  const allKeys = new Set([]);
  const btnsCopy = (buttons || []).map(({ label, state_formula }) => {
    const state_obj = eval_expression(state_formula, {});
    Object.keys(state_obj).forEach((k) => allKeys.add(k));
    return {
      label,
      state_formula,
      state_obj,
    };
  });
  return div(
    horizontal && spacing === 0 ? { class: "btn-group", role: "group" } : {},
    btnsCopy.map(({ label, state_formula, state_obj }) => {
      const myKeys = new Set(Object.keys(state_obj));

      const active = [...myKeys].every((k) => state[k] == state_obj[k]);
      const unsetKeys = active
        ? [...allKeys]
        : [...allKeys].filter((k) => !myKeys.has(k));
      let style, size;
      return button(
        {
          class: [
            "btn",
            !horizontal && "d-block",
            horizontal ? `me-${spacing} mb-${spacing}` : `mb-${spacing}`,
            active
              ? `btn-${style || "primary"}`
              : `btn-outline-${style || "primary"}`,
            size && size,
          ],
          onClick: `set_state_fields({${unsetKeys
            .map((k) => `${k}: {unset: true},`)
            .join("")}${[...(active ? [] : myKeys)]
            .map(
              (k) =>
                `${k}: ${
                  typeof state_obj[k] === "string"
                    ? `'${state_obj[k]}'`
                    : state_obj[k]
                },`
            )
            .join("")}},false,this)`,
        },
        label
      );
    })
  );
};

const or_if_undef = (x, y) => (typeof x === "undefined" ? y : x);
const eq_string = (x, y) => `${x}` === `${y}`;

module.exports = {
  name: "Custom State FilterButtonGroup",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  run,
};
