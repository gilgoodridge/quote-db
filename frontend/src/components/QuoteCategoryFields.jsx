import {categoryDimensions} from '../quoteCategories'

export default function QuoteCategoryFields({ catalog, selections, onChange }) {
  return (
    <section className="quote-category-fields" aria-labelledby="quote-categories-title">
      <h3 id="quote-categories-title">Categories</h3>
      <p className="quote-category-help">Optional. Select as many as apply in each group, or leave them empty.</p>
      {categoryDimensions.map(({ key, field, label, description }) => (
        <fieldset key={key} className="quote-category-group" aria-describedby={`quote-${key}-help`}>
          <legend>{label} <span className="quote-category-count">({selections[field].length} selected)</span></legend>
          <div className="quote-category-heading">
            <p id={`quote-${key}-help`} className="quote-category-help">{description}</p>
            <button
              type="button"
              className="quote-category-clear"
              disabled={selections[field].length === 0}
              aria-label={`Clear ${label.toLowerCase()} selections`}
              onClick={() => onChange(field, [])}
            >Clear</button>
          </div>
          <div className="quote-category-options">
            {catalog[key].map((option) => (
              <label key={option.id} className="quote-category-option" title={option.description}>
                <input
                  type="checkbox"
                  name={field}
                  value={option.id}
                  aria-label={option.name}
                  aria-describedby={option.description ? `quote-${key}-${option.id}-description` : undefined}
                  checked={selections[field].includes(option.id)}
                  onChange={(event) => onChange(field, event.target.checked
                    ? [...selections[field], option.id]
                    : selections[field].filter((id) => id !== option.id))}
                />
                <span>{option.name}</span>
                {option.description && (
                  <span id={`quote-${key}-${option.id}-description`} className="category-description-sr">
                    {option.description}
                  </span>
                )}
              </label>
            ))}
          </div>
          {catalog[key].length === 0 && <p className="quote-category-help">No options available.</p>}
        </fieldset>
      ))}
    </section>
  )
}
