import React from 'react';

import { FormControl, FormHelperText, TextField } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';
import type { WebAdapterConfig } from '../types';

const styles: Record<string, React.CSSProperties> = {
    input: {
        minWidth: 300,
    },
    inputNumber: {
        minWidth: 150,
    },
    heightInput: {
        height: 30,
    },
};

interface CustomInputProps {
    title?: string;
    attr?: string;
    type?: 'text' | 'number' | 'password' | 'color';
    table?: boolean;
    value?: string;
    variant?: 'filled' | 'standard' | 'outlined';
    size?: 'medium' | 'small';
    style: React.CSSProperties;
    native?: WebAdapterConfig;
    onChange: (attr: string, value?: any) => void;
    component?: React.ReactNode;
    styleComponentBlock?: React.CSSProperties;
}

export function CustomInput(props: CustomInputProps): React.JSX.Element {
    const { styleComponentBlock, component, size, variant, table, value, title, attr, type, style, native, onChange } =
        props;

    return (
        <FormControl style={{ ...(type === 'number' ? styles.inputNumber : styles.input), paddingTop: 5, ...style }}>
            <TextField
                variant={variant || 'standard'}
                value={table ? value : attr ? (native as unknown as Record<string, string>)[attr] : ''}
                type={type || 'text'}
                style={{ ...styles.heightInput, ...style }}
                onChange={e => {
                    if (table) {
                        onChange(e.target.value);
                    } else {
                        onChange(attr as string, e.target.value);
                    }
                }}
                margin="normal"
                size={size || 'medium'}
            />
            <div style={styleComponentBlock}>
                <FormHelperText style={{ marginTop: -3 }}>{title ? I18n.t(title) : ''}</FormHelperText>
                {component}
            </div>
        </FormControl>
    );
}
