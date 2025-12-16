import TenantOnboarding from '@/src/components/saas/TenantOnboarding'

export default function OnboardingPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0c] bg-pattern flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-500/20 rounded-full blur-[128px]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[128px]" />
            </div>

            <div className="relative z-10 w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
                        Bem-vindo ao <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">ServiceDesk Pro</span>
                    </h1>
                    <p className="text-neutral-400 text-lg">
                        Configure seu ambiente corporativo em poucos minutos.
                    </p>
                </div>

                <TenantOnboarding />
            </div>
        </div>
    )
}
