import React, { type ChangeEvent, useState } from 'react';

import { TextField, Button, Box } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

const styles: Record<string, any> = {
    root: {
        '& > *': {
            m: '8px',
        },
    },
    input: {
        display: 'none',
    },
};

interface CustomButtonUploadProps {
    title: string;
    onChange: (file: File, name: (name: string) => void) => void;
}

export function CustomButtonUpload(props: CustomButtonUploadProps): React.JSX.Element {
    const { title, onChange } = props;
    const [valueFileUpload, setValueFileUpload] = useState('');

    return (
        <Box
            component="div"
            sx={styles.root}
        >
            <input
                accept="image/*"
                style={styles.input || ''}
                id="contained-button-file"
                multiple
                type="file"
                onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                    onChange(e.target.files?.[0] || (e as any).dataTransfer.files[0], name => setValueFileUpload(name))
                }
            />
            <label htmlFor="contained-button-file">
                <Button
                    variant="contained"
                    color="primary"
                    component="span"
                >
                    {I18n.t(title)}
                </Button>
                <TextField
                    variant="standard"
                    style={{ marginLeft: 20 }}
                    value={valueFileUpload}
                />
            </label>
        </Box>
    );
}
