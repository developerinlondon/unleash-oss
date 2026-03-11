import ResponsiveButton from 'component/common/ResponsiveButton/ResponsiveButton';
import Add from '@mui/icons-material/Add';
import { ADMIN } from 'component/providers/AccessProvider/permissions';
import { useNavigate } from 'react-router-dom';

export const CreateEnvironmentButton = () => {
    const navigate = useNavigate();

    return (
        <ResponsiveButton
            onClick={() => navigate('/environments/create')}
            maxWidth='700px'
            Icon={Add}
            permission={ADMIN}
        >
            New environment
        </ResponsiveButton>
    );
};
