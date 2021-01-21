import { FormControl, FormHelperText, TextField, withStyles } from '@material-ui/core';
import React from 'react';
import I18n from '@iobroker/adapter-react/i18n';
import PropTypes from 'prop-types';

const styles = theme => ({
    input: {
        minWidth: 300
    },
    input_namber: {
        minWidth: 150
    },
    height_input: {
        height: 30
    }
});

const CustomInput = ({ size, variant, table, value, title, attr, type, style, classes, native, onChange, className }) => {
    const error = false;
    return (<FormControl className={`${type === 'number' ? classes.input_namber : classes.input + ' ' + classes.controlElement} ${className}`} style={Object.assign({ paddingTop: 5 }, style)}>
        <TextField
            error={!!error}
            variant={variant}
            value={table ? value : native[attr]}
            type={type}
            helperText={error || ''}
            style={style}
            className={classes.height_input}
            onChange={e => {
                if (table) {
                    onChange(e.target.value);
                } else {
                    onChange(attr, e.target.value);
                }
            }}
            margin="normal"
            size={size}
        />
        <FormHelperText style={{ marginTop: -3 }}>{I18n.t(title)}</FormHelperText>
    </FormControl>);
}

CustomInput.defaultProps = {
    value: '',
    type: 'text',
    className: null,
    table: false,
    native: {},
    variant: 'standard',
    size: 'medium'
};

CustomInput.propTypes = {
    title: PropTypes.string,
    attr: PropTypes.string,
    type: PropTypes.string,
    style: PropTypes.object,
    native: PropTypes.object,
    onChange: PropTypes.func
};

export default withStyles(styles)(CustomInput);