const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
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
        name: "Field",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();

          return new Form({
            fields: [
              {
                name: "field_name",
                label: "Field",
                type: "String",
                required: true,
                attributes: {
                  options: fields.map((f) => f.name),
                },
              },
              {
                name: "neutral_label",
                label: "Neutral label",
                default: "All",
                type: "String",
              },
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
              {
                name: "disjunction",
                label: "Disjunction",
                sublabel: "OR filter value",
                type: "Bool",
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
  { field_name, neutral_label, horizontal, spacing, disjunction },
  state,
  extra
) => {
  const table = await Table.findOne(table_id);
  const fields = await table.getFields();
  readState(state, fields);
  const field = fields.find((f) => f.name === field_name);
  let distinct_values = [];

  if (table.external) {
    distinct_values = (await table.distinctValues(field_name)).map((x) => ({
      label: x,
      value: x,
    }));
  } else if (field) distinct_values = await field.distinct_values(extra.req);
  else if (field_name.includes(".")) {
    const kpath = field_name.split(".");
    if (kpath.length === 3) {
      const [jtNm, jFieldNm, lblField] = kpath;
      const jtable = await Table.findOne({ name: jtNm });
      const jfields = await jtable.getFields();
      const jfield = jfields.find((f) => f.name === lblField);
      if (jfield) distinct_values = await jfield.distinct_values();
    }
  }
  if (distinct_values && distinct_values[0]) {
    if (distinct_values[0].value !== "") {
      distinct_values.unshift({ label: "", value: "" });
    }
  }
  return div(
    horizontal && spacing === 0 ? { class: "btn-group", role: "group" } : {},
    distinct_values.map(({ label, value, jsvalue }) => {
      const active =
        (disjunction &&
          Array.isArray(state[field_name]) &&
          (state[field_name].includes(value) ||
            state[field_name].includes(jsvalue))) ||
        state[field_name] === or_if_undef(jsvalue, value) ||
        (!value && !state[field_name]);
      let style, size;
      let onClick;
      if (!disjunction)
        onClick =
          active || !value
            ? `unset_state_field('${field_name}', this)`
            : `set_state_field('${field_name}', '${value || ""}',this)`;
      else {
        if (!value) onClick = `unset_state_field('${field_name}',this)`;
        else
          onClick = `check_state_field({name: '${field_name}', value: '${value}', checked: ${JSON.stringify(
            !active
          )}}, this)`;
      }
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
          onClick,
        },
        !value && !label ? neutral_label : label || value
      );
    })
  );
};

const or_if_undef = (x, y) => (typeof x === "undefined" ? y : x);
const eq_string = (x, y) => `${x}` === `${y}`;

module.exports = {
  sc_plugin_api_version: 1,
  viewtemplates: [
    {
      name: "FilterButtonGroup",
      display_state_form: false,
      get_state_fields,
      configuration_workflow,
      run,
    },
    require("./custom-state"),
  ],
};
