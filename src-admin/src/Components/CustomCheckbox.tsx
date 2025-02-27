import React from 'react';

import { Checkbox, FormControlLabel, FormGroup, FormHelperText } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

interface CustomCheckboxProps {
    title?: string;
    attr: string;
    style?: React.CSSProperties;
    groupStyle?: React.CSSProperties;
    native: Record<string, any>;
    onChange: (attr: string | boolean, value?: any) => void;
    table?: boolean;
    checked?: boolean;
    disabled?: boolean;
    help?: string;
    sx?: Record<string, any>;
}

export function CustomCheckbox(props: CustomCheckboxProps): React.JSX.Element {
    const { title, attr, style, native, sx, onChange, table, checked, disabled, help } = props;
    let value = table ? checked : native[attr];
    if (attr === 'whiteListEnabled' && native.socketio) {
        value = false;
    }

    return (
        <FormGroup style={props.groupStyle}>
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
}
