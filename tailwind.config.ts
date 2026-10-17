import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
			},
			// Option B type scale: page title 30 bold, card heading 18 bold, body 14.5, small 12.5.
			fontSize: {
				'page-title': ['30px', { lineHeight: '38px', fontWeight: '700', letterSpacing: '-0.01em' }],
				'card-title': ['18px', { lineHeight: '26px', fontWeight: '700' }],
				body: ['14.5px', { lineHeight: '22px' }],
				small: ['12.5px', { lineHeight: '18px' }],
			},
			spacing: {
				sidebar: '248px',
				touch: '44px',
			},
			minHeight: { touch: '44px' },
			minWidth: { touch: '44px' },
			colors: {
				brand: {
					blue: 'hsl(var(--brand-blue))',
					navy: 'hsl(var(--brand-navy))',
					'navy-foreground': 'hsl(var(--brand-navy-foreground))',
					'navy-muted': 'hsl(var(--brand-navy-muted))',
				},
				link: 'hsl(var(--link))',
				nav: {
					active: 'hsl(var(--nav-active))',
					hover: 'hsl(var(--nav-hover))',
					marker: 'hsl(var(--nav-marker))',
				},
				focus: 'hsl(var(--focus-ring))',
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				surface: {
					DEFAULT: 'hsl(var(--surface))',
					subtle: 'hsl(var(--surface-subtle))'
				},
				success: 'hsl(var(--success))',
				warning: 'hsl(var(--warning))',
				info: 'hsl(var(--info))',
				priority: {
					urgent: 'hsl(var(--priority-urgent))',
					'urgent-foreground': 'hsl(var(--priority-urgent-foreground))',
					'urgent-border': 'hsl(var(--priority-urgent-border))',
					high: 'hsl(var(--priority-high))',
					'high-foreground': 'hsl(var(--priority-high-foreground))',
					'high-border': 'hsl(var(--priority-high-border))',
					medium: 'hsl(var(--priority-medium))',
					'medium-foreground': 'hsl(var(--priority-medium-foreground))',
					'medium-border': 'hsl(var(--priority-medium-border))',
					low: 'hsl(var(--priority-low))',
					'low-foreground': 'hsl(var(--priority-low-foreground))',
					'low-border': 'hsl(var(--priority-low-border))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				card: 'var(--radius-card)',
				control: 'var(--radius)',
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			gridTemplateColumns: {
				'13': 'repeat(13, minmax(0, 1fr))'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
