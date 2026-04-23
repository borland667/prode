import { createElement } from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function PageShell({ as: Component = 'div', size = 'default', className = '', children, ...props }) {
  const sizeClass = {
    default: 'ds-page',
    narrow: 'ds-page-narrow',
    md: 'ds-page-md',
  }[size] || 'ds-page';

  return createElement(Component, { className: cx(sizeClass, className), ...props }, children);
}

export function Panel({
  as: Component = 'div',
  variant = 'default',
  padding = 'none',
  radius = 'lg',
  className = '',
  children,
  ...props
}) {
  const variantClass = variant === 'strong' ? 'ds-panel-strong' : 'ds-panel';
  const paddingClass = {
    none: '',
    normal: 'ds-panel-pad',
    compact: 'ds-panel-pad-compact',
    loft: 'ds-panel-pad ds-panel-pad-loft-top',
  }[padding] || '';
  const radiusClass = {
    sm: 'rounded-panel-sm',
    md: 'rounded-panel-md',
    lg: 'rounded-panel-lg',
    xl: 'rounded-panel-xl',
    '2xl': 'rounded-panel-2xl',
  }[radius] || 'rounded-panel-lg';

  return createElement(
    Component,
    { className: cx(variantClass, radiusClass, paddingClass, className), ...props },
    children
  );
}

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'default',
  block = false,
  className = '',
  children,
  ...props
}) {
  const variantClass = {
    primary: 'ds-button ds-button-primary',
    secondary: 'ds-button-secondary',
    ghost: 'ds-button ds-button-ghost',
    danger: 'ds-button ds-button-danger',
  }[variant] || 'ds-button ds-button-primary';
  const sizeClass = size === 'sm' ? 'ds-button-sm' : '';
  const blockClass = block ? 'w-full' : '';
  const buttonProps = Component === 'button' && !props.type ? { type: 'button' } : {};

  return createElement(
    Component,
    { className: cx(variantClass, sizeClass, blockClass, className), ...buttonProps, ...props },
    children
  );
}

export function Pill({ as: Component = 'span', compact = false, className = '', children, ...props }) {
  return createElement(
    Component,
    { className: cx('ds-pill', compact && 'ds-pill--compact', className), ...props },
    children
  );
}

export function DisplayText({ as: Component = 'h2', className = '', children, ...props }) {
  return createElement(Component, { className: cx('ds-display', className), ...props }, children);
}
