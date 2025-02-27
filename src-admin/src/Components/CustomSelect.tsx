import React from 'react';

import { FormControl, FormHelperText, Input, MenuItem, Select } from '@mui/material';

import { I18n, Utils, Icon, type ThemeType } from '@iobroker/adapter-react-v5';
import type { WebAdapterConfig } from '../../../src/types';

const styles: Record<string, React.CSSProperties> = {
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

interface CustomSelectProps {
    title?: string;
    attr?: string;
    options: { value: string; title: string; icon?: string; color?: string }[];
    style?: React.CSSProperties;
    sx?: Record<string, any>;
    value?: any;
    table?: boolean;
    native: WebAdapterConfig;
    onChange: (attr: string, value?: any, cb?: () => void) => void;
    noTranslate?: boolean;
    themeType: ThemeType;
}

export function CustomSelect(props: CustomSelectProps): React.JSX.Element {
    const { table, value, title, attr, options, style, native, onChange, noTranslate, themeType, sx } = props;
    return (
        <FormControl
            style={{ paddingTop: 5, ...style }}
            sx={{ ...sx, ...styles.input }}
        >
            <Select
                variant="standard"
                value={table ? value : attr ? (native as unknown as Record<string, string | number>)[attr] || '_' : '_'}
                onChange={e => {
                    if (table) {
                        onChange(e.target.value);
                    } else {
                        onChange(attr!, e.target.value === '_' ? '' : e.target.value);
                    }
                }}
                renderValue={_item => {
                    const item = options.find(it => it.value === _item);
                    return item ? (
                        <>
                            <Icon
                                src={item.icon || ''}
                                style={styles.icon}
                            />
                            {noTranslate ? item.title : I18n.t(item.title)}
                        </>
                    ) : (
                        _item
                    );
                }}
                input={
                    <Input
                        name={attr}
                        id={`${attr}-helper`}
                    />
                }
            >
                {options.map(item => (
                    <MenuItem
                        key={`key-${item.value}`}
                        value={item.value || '_'}
                        style={
                            item.color
                                ? {
                                      color: item.color,
                                      backgroundColor: Utils.getInvertedColor
                                          ? Utils.getInvertedColor(item.color, themeType)
                                          : undefined,
                                  }
                                : {}
                        }
                    >
                        <Icon
                            src={item.icon || ''}
                            style={styles.icon}
                        />
                        {noTranslate ? item.title : I18n.t(item.title)}
                    </MenuItem>
                ))}
            </Select>
            <FormHelperText>{title ? I18n.t(title) : ''}</FormHelperText>
        </FormControl>
    );
}
