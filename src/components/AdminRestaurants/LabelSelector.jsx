import { LABEL_OPTIONS } from '../../data/labels';
import PropTypes from 'prop-types';
import './LabelSelector.scss';

const LabelSelector = ({ selectedLabels = [], onChange }) => {
  const handleLabelToggle = (labelCode) => {
    const newLabels = selectedLabels.includes(labelCode)
      ? selectedLabels.filter(label => label !== labelCode)
      : [...selectedLabels, labelCode];
    
    onChange(newLabels);
  };

  return (
    <div className="label-selector">
      <label className="label-selector__title">Dietary Labels</label>
      <p className="label-selector__description">
        Select all applicable dietary labels for this menu item
      </p>
      <div className="label-selector__options">
        {LABEL_OPTIONS.map(({ code, description }) => (
          <label key={code} className="label-selector__option">
            <input
              type="checkbox"
              checked={selectedLabels.includes(code)}
              onChange={() => handleLabelToggle(code)}
              className="label-selector__checkbox"
            />
            <span className="label-selector__label">
              <span className="label-selector__code">{code}</span>
              <span className="label-selector__description">{description}</span>
            </span>
          </label>
        ))}
      </div>
      {selectedLabels.length > 0 && (
        <div className="label-selector__preview">
          <span className="label-selector__preview-label">Selected:</span>
          <div className="label-selector__selected">
            {selectedLabels.map(label => (
              <span key={label} className="label-selector__tag">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

LabelSelector.propTypes = {
  selectedLabels: PropTypes.array,
  onChange: PropTypes.func.isRequired
};

export default LabelSelector;
