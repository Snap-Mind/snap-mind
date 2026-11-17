import { useState } from 'react';
import { Input } from '@heroui/react';
import Icon from '../components/Icon';

function PasswordInput({ ...props }) {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => setIsVisible(!isVisible);

  return (
    <>
      <Input
        type={isVisible ? 'text' : 'password'}
        endContent={
          <button
            aria-label="toggle password visibility"
            className="focus:outline-solid outline-transparent"
            type="button"
            onClick={toggleVisibility}
          >
            {isVisible ? (
              <Icon icon="eye-off" svgClassName="inline-block" />
            ) : (
              <Icon icon="eye" svgClassName="inline-block" />
            )}
          </button>
        }
        {...props}
      />
    </>
  );
}

export default PasswordInput;
