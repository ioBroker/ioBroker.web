import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';

import { withStyles } from '@mui/styles';
import { Checkbox, FormControlLabel, FormGroup, FormHelperText } from '@mui/material';

import I18n from '@iobroker/adapter-react-v5/i18n';

const styles = theme => ({
    input: {
        minWidth: 300
    }
});

const CustomCheckbox = ({ title, attr, style, classes, native, onChange, className, table, checked, disabled, help }) => {
    let value = table ? checked : native[attr];
    if (attr === 'whiteListEnabled' && native.socketio) {
        value = false;
    }

    return <FormGroup>
            <FormControlLabel
            key={attr}
            style={Object.assign({ paddingTop: 5 }, style)}
            className={clsx(classes.controlElement, className)}
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
    </FormGroup>;
}

CustomCheckbox.defaultProps = {
    table: false,
    className: null
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

export default withStyles(styles)(CustomCheckbox);
