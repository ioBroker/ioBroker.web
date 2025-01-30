import React from 'react';
import PropTypes from 'prop-types';

import { Checkbox, FormControlLabel, FormGroup, FormHelperText } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

const CustomCheckbox = ({ title, attr, style, native, sx, onChange, table, checked, disabled, help }) => {
    let value = table ? checked : native[attr];
    if (attr === 'whiteListEnabled' && native.socketio) {
        value = false;
    }

    return (
        <FormGroup>
            <FormControlLabel
                key={attr}
                style={{ paddingTop: 5, ...style }}
                sx={sx}
                control={
                    <Checkbox
                        disabled={!!disabled}
                        checked={!!value}
                        onChange={el => {
                            if (table) {
                                onChange(el.target.checked);
                            } else {
                                onChange(attr, !native[attr]);
                            }
                        }}
                        color="primary"
                    />
                }
                label={title ? I18n.t(title) : ''}
            />
            {help ? <FormHelperText>{help}</FormHelperText> : null}
        </FormGroup>
    );
};

CustomCheckbox.defaultProps = {
    table: false,
};

CustomCheckbox.propTypes = {
    title: PropTypes.string,
    attr: PropTypes.string.isRequired,
    style: PropTypes.object,
    native: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    table: PropTypes.bool,
    help: PropTypes.string,
};

export default CustomCheckbox;
