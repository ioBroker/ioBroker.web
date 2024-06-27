import React from 'react';
import PropTypes from 'prop-types';

import {
    FormControl, FormHelperText, Input, MenuItem, Select,
} from '@mui/material';

import { I18n, Utils, Icon } from '@iobroker/adapter-react-v5';

const styles = {
    input: {
        minWidth: 300,
    },
    inputNumber: {
        minWidth: 150,
    },
    icon: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
};

const CustomSelect = ({
    table, value, title, attr, options, style, native, onChange, noTranslate, themeType, sx,
}) => <FormControl
    style={({ ...styles.input, paddingTop: 5, ...style })}
    sx={sx}
>
    <Select
        variant="standard"
        value={table ? value : native[attr] || '_'}
        onChange={e => {
            if (table) {
                onChange(e.target.value);
            } else {
                onChange(attr, e.target.value === '_' ? '' : e.target.value);
            }
        }}
        renderValue={_item => {
            const item = options.find(it => it.value === _item);
            return item ? <>
                <Icon src={item.icon || ''} style={styles.icon} />
                {noTranslate ? item.title : I18n.t(item.title)}
            </> : _item;
        }}
        input={<Input name={attr} id={`${attr}-helper`} />}
    >
        {options.map(item =>
            <MenuItem key={`key-${item.value}`} value={item.value || '_'} style={item.color ? { color: item.color, backgroundColor: Utils.getInvertedColor ? Utils.getInvertedColor(item.color, themeType) : undefined } : {}}>
                <Icon src={item.icon || ''} style={styles.icon} />
                {noTranslate ? item.title : I18n.t(item.title)}
            </MenuItem>)}
    </Select>
    <FormHelperText>{title ? I18n.t(title) : ''}</FormHelperText>
</FormControl>;

CustomSelect.defaultProps = {
    value: '',
    table: false,
};

CustomSelect.propTypes = {
    title: PropTypes.string,
    attr: PropTypes.string,
    options: PropTypes.array.isRequired,
    style: PropTypes.object,
    sx: PropTypes.object,
    value: PropTypes.any,
    table: PropTypes.bool,
    native: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    noTranslate: PropTypes.bool,
    themeType: PropTypes.string,
};

export default CustomSelect;
