import React, { Component } from 'react';

import { TextField, Checkbox, FormControlLabel, Button } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

import type { WebAdapterConfig } from '../../../src/types';

interface AdditionallyProps {
    native: WebAdapterConfig;
    onChange: (attr: string, value: any, cb?: () => void) => void;
}

class Cors extends Component<AdditionallyProps> {
    render(): React.JSX.Element {
        const { native, onChange } = this.props;
        return (
            <div
                style={{
                    width: '100%',
                    minHeight: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    flexDirection: 'column',
                }}
            >
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={!!native.accessControlEnabled}
                            onChange={() => onChange('accessControlEnabled', !native.accessControlEnabled)}
                            color="primary"
                        />
                    }
                    label={I18n.t('custom_cors_settings')}
                />
                {native.accessControlEnabled ? (
                    <Button
                        variant="contained"
                        onClick={() => {
                            onChange('accessControlAllowOrigin', '*', () =>
                                onChange('accessControlAllowMethods', 'GET,PUT,POST,DELETE,OPTIONS', () =>
                                    onChange(
                                        'accessControlAllowHeaders',
                                        'Content-Type, Authorization, Content-Length, X-Requested-With, *',
                                        () =>
                                            onChange('accessControlAllowCredentials', true, () =>
                                                onChange('accessControlExposeHeaders', '', () =>
                                                    onChange('accessControlMaxAge', 86400),
                                                ),
                                            ),
                                    ),
                                ),
                            );
                        }}
                    >
                        {I18n.t('reset_cors_settings')}
                    </Button>
                ) : null}
                {native.accessControlEnabled ? (
                    <TextField
                        fullWidth
                        variant="standard"
                        value={native.accessControlAllowOrigin || ''}
                        onChange={e => onChange('accessControlAllowOrigin', e.target.value)}
                        label="Access-Control-Allow-Origin"
                    />
                ) : null}
                {native.accessControlEnabled ? (
                    <TextField
                        fullWidth
                        variant="standard"
                        value={native.accessControlAllowMethods || ''}
                        onChange={e => onChange('accessControlAllowMethods', e.target.value)}
                        label="Access-Control-Allow-Methods"
                    />
                ) : null}
                {native.accessControlEnabled ? (
                    <TextField
                        fullWidth
                        variant="standard"
                        value={native.accessControlAllowHeaders || ''}
                        onChange={e => onChange('accessControlAllowHeaders', e.target.value)}
                        label="Access-Control-Allow-Headers"
                    />
                ) : null}
                {native.accessControlEnabled ? (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!native.accessControlAllowCredentials}
                                onChange={() =>
                                    onChange('accessControlAllowCredentials', !native.accessControlAllowCredentials)
                                }
                                color="primary"
                            />
                        }
                        label="Access-Control-Allow-Credentials"
                    />
                ) : null}
                {native.accessControlEnabled ? (
                    <TextField
                        fullWidth
                        variant="standard"
                        value={native.accessControlExposeHeaders || ''}
                        onChange={e => onChange('accessControlExposeHeaders', e.target.value)}
                        label="Access-Control-Expose-Headers"
                    />
                ) : null}
                {native.accessControlEnabled ? (
                    <TextField
                        fullWidth
                        variant="standard"
                        type="number"
                        value={native.accessControlMaxAge || ''}
                        onChange={e => onChange('accessControlMaxAge', e.target.value)}
                        label="Access-Control-Max-Age"
                    />
                ) : null}
            </div>
        );
    }
}

export default Cors;
