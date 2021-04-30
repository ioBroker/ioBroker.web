import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

import { FormControl, FormHelperText, Input, MenuItem, Select, withStyles } from '@material-ui/core';

import I18n from '@iobroker/adapter-react/i18n';
import Icon from '@iobroker/adapter-react/Components/Icon';
import Utils from '@iobroker/adapter-react/Components/Utils';

const styles = theme => ({
    input: {
        minWidth: 300
    },
    inputNumber: {
        minWidth: 150
    },
    icon: {
        width: 24,
        height: 24,
        marginRight: 8
    }
});

const CustomSelect = ({ table, value, title, attr, options, style, classes, native, onChange, className, noTranslate, themeType }) => {
    return <FormControl
        className={clsx(classes.input, classes.controlElement, className)}
        style={Object.assign({ paddingTop: 5 }, style)}
    >
        <Select
            value={table ? value : native[attr] || '_'}
            onChange={e => {
                if (table) {
                    onChange(e.target.value);
                } else {
                    onChange(attr, e.target.value === '_' ? '' : e.target.value)
                }
            }}
            renderValue={_item => {
                const item = options.find(it => it.value === _item);
                return item ? <>
                    <Icon src={item.icon} className={classes.icon}/>
                    {noTranslate ? item.title : I18n.t(item.title)}
                </> : _item
            }}
            input={<Input name={attr} id={attr + '-helper'} />}
        >
            {options.map(item =>
                <MenuItem key={'key-' + item.value} value={item.value || '_'} style={item.color ? {color: item.color, backgroundColor: Utils.getInvertedColor ? Utils.getInvertedColor(item.color, themeType) : undefined} : {}}>
                    <Icon src={item.icon} className={classes.icon}/>
                    {noTranslate ? item.title : I18n.t(item.title)}
                </MenuItem>)}
        </Select>
        <FormHelperText>{I18n.t(title)}</FormHelperText>
    </FormControl>;
}

CustomSelect.defaultProps = {
    value: '',
    className: null,
    table: false
};

CustomSelect.propTypes = {
    title: PropTypes.string,
    attr: PropTypes.string,
    options: PropTypes.array.isRequired,
    style: PropTypes.object,
    native: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    noTranslate: PropTypes.bool,
    themeType: PropTypes.string
};

export default withStyles(styles)(CustomSelect);