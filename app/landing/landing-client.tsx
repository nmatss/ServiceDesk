"use client"

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Home,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Award,
  Check,
  ArrowRight,
  Menu,
  X,
  Twitter,
  Github,
  Linkedin,
  Mail,
  ChevronRight,
  Star
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// NavBar Component
interface NavItem {
  name: string
  url: string
  icon: React.ElementType
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

function NavBar({ items, className }: NavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0].name)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className={cn("fixed top-0 left-1/2 -translate-x-1/2 z-50 pt-6 w-full max-w-7xl px-4", className)}>
      <div className="flex items-center justify-between gap-3 bg-background/80 border border-border backdrop-blur-lg py-3 px-6 rounded-full shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden sm:inline">ProLanding</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.name
            return (
              <a
                key={item.name}
                href={item.url}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  "relative cursor-pointer text-sm font-semibold px-4 py-2 rounded-full transition-colors",
                  "text-foreground/80 hover:text-primary",
                  isActive && "bg-muted text-primary"
                )}
              >
                <span>{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                )}
              </a>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button size="sm" className="hidden sm:inline-flex">Get Started</Button>
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="md:hidden mt-2 bg-background/95 backdrop-blur-lg border border-border rounded-2xl p-4 shadow-xl"
        >
          {items.map((item) => (
            <a
              key={item.name}
              href={item.url}
              className="block py-3 px-4 rounded-lg hover:bg-muted transition-colors"
              onClick={() => {
                setActiveTab(item.name)
                setMobileMenuOpen(false)
              }}
            >
              {item.name}
            </a>
          ))}
        </motion.div>
      )}
    </div>
  )
}

// Modern Hero Section with Image Collage
function HeroSection() {
  const images = [
    "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&auto=format&fit=crop&q=80",
  ]

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-24 pb-12">
      <div className="container relative z-10 mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Zap className="w-3.5 h-3.5 text-primary mr-2" />
              <span className="text-xs font-medium">AI-Powered Landing Pages</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 leading-[1.1]"
            >
              Build Your{" "}
              <span className="bg-gradient-to-r from-primary via-blue-500 to-purple-600 bg-clip-text text-transparent">
                Dream
              </span>
              <br />
              Landing Page
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl"
            >
              Create stunning, high-converting landing pages powered by AI.
              No coding required. SEO optimized and mobile responsive.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button size="lg" className="text-lg px-8">
                Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Watch Demo
              </Button>
            </motion.div>
          </div>

          {/* Right Image Collage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative h-[500px] lg:h-[600px]"
          >
            {/* Image 1 - Top Left */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="absolute top-0 left-0 w-48 h-48 md:w-56 md:h-56 overflow-hidden rounded-3xl shadow-2xl border-4 border-background z-10"
              whileHover={{ scale: 1.05, rotate: -2, zIndex: 50 }}
            >
              <img src={images[0]} alt="Team collaboration" className="w-full h-full object-cover" />
            </motion.div>

            {/* Image 2 - Top Right */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="absolute top-16 right-0 w-40 h-40 md:w-48 md:h-48 overflow-hidden rounded-3xl shadow-2xl border-4 border-background z-20"
              whileHover={{ scale: 1.05, rotate: 2, zIndex: 50 }}
            >
              <img src={images[1]} alt="Business meeting" className="w-full h-full object-cover" />
            </motion.div>

            {/* Image 3 - Center Left */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="absolute top-40 left-8 w-52 h-52 md:w-64 md:h-64 overflow-hidden rounded-3xl shadow-2xl border-4 border-background z-30"
              whileHover={{ scale: 1.05, rotate: -3, zIndex: 50 }}
            >
              <img src={images[2]} alt="Team discussion" className="w-full h-full object-cover" />
            </motion.div>

            {/* Image 4 - Center Right */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute top-52 right-12 w-44 h-44 md:w-52 md:h-52 overflow-hidden rounded-3xl shadow-2xl border-4 border-background z-20"
              whileHover={{ scale: 1.05, rotate: 3, zIndex: 50 }}
            >
              <img src={images[3]} alt="Workspace" className="w-full h-full object-cover" />
            </motion.div>

            {/* Image 5 - Bottom Center */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-48 md:w-56 md:h-56 overflow-hidden rounded-3xl shadow-2xl border-4 border-background z-10"
              whileHover={{ scale: 1.05, rotate: -2, zIndex: 50 }}
            >
              <img src={images[4]} alt="Creative work" className="w-full h-full object-cover" />
            </motion.div>

            {/* Decorative elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 rounded-full blur-3xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// Features Section
function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Optimized for speed with cutting-edge technology. Load times under 1 second guaranteed."
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with 99.9% uptime. Your data is always protected."
    },
    {
      icon: TrendingUp,
      title: "SEO Optimized",
      description: "Built-in SEO best practices to help you rank higher in search results."
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Work together seamlessly with real-time collaboration features."
    },
    {
      icon: Award,
      title: "Award Winning",
      description: "Recognized by industry leaders for excellence in design and functionality."
    },
    {
      icon: Home,
      title: "Easy Integration",
      description: "Connect with your favorite tools and services in just a few clicks."
    }
  ]

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Everything You Need to Succeed
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Powerful features designed to help you create, launch, and grow your business
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Pricing Section
function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)

  const plans = [
    {
      name: "Starter",
      description: "Perfect for individuals and small projects",
      price: isYearly ? 99 : 12,
      features: [
        "Up to 5 landing pages",
        "Basic analytics",
        "Email support",
        "Mobile responsive",
        "SSL certificate"
      ],
      popular: false
    },
    {
      name: "Professional",
      description: "Best for growing businesses",
      price: isYearly ? 299 : 29,
      features: [
        "Unlimited landing pages",
        "Advanced analytics",
        "Priority support",
        "A/B testing",
        "Custom domain",
        "Team collaboration",
        "Advanced SEO tools"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      description: "For large organizations",
      price: isYearly ? 899 : 99,
      features: [
        "Everything in Professional",
        "Dedicated account manager",
        "Custom integrations",
        "White-label solution",
        "SLA guarantee",
        "Advanced security",
        "Custom training"
      ],
      popular: false
    }
  ]

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground mb-8"
          >
            Choose the perfect plan for your needs
          </motion.p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={cn("text-sm font-medium", !isYearly && "text-primary")}>Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={cn(
                "relative w-14 h-7 rounded-full transition-colors",
                isYearly ? "bg-primary" : "bg-muted"
              )}
            >
              <motion.div
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                animate={{ x: isYearly ? 28 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={cn("text-sm font-medium", isYearly && "text-primary")}>
              Yearly <span className="text-xs text-green-600">(Save 20%)</span>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={cn(
                "relative h-full",
                plan.popular && "border-primary shadow-lg scale-105"
              )}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{isYearly ? 'year' : 'month'}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full mb-6" variant={plan.popular ? "default" : "outline"}>
                    Get Started
                  </Button>
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Testimonials Section
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "CEO, TechStart",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
      content: "This platform transformed how we build landing pages. The results have been incredible - 300% increase in conversions!"
    },
    {
      name: "Michael Chen",
      role: "Marketing Director, GrowthCo",
      image: "https://randomuser.me/api/portraits/men/32.jpg",
      content: "The best investment we've made. Easy to use, powerful features, and outstanding support. Highly recommended!"
    },
    {
      name: "Emily Rodriguez",
      role: "Founder, StartupHub",
      image: "https://randomuser.me/api/portraits/women/68.jpg",
      content: "Finally, a landing page builder that actually delivers on its promises. Our team loves it and so do our customers."
    }
  ]

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Loved by Thousands
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground"
          >
            See what our customers have to say
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div>
                      <h4 className="font-semibold">{testimonial.name}</h4>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground">{testimonial.content}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  const footerLinks = {
    Product: ["Features", "Pricing", "Templates", "Integrations"],
    Company: ["About", "Blog", "Careers", "Contact"],
    Resources: ["Documentation", "Help Center", "Community", "Status"],
    Legal: ["Privacy", "Terms", "Security", "Cookies"]
  }

  return (
    <footer className="bg-background border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-8 mb-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">ProLanding</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Build beautiful landing pages that convert.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 bg-muted rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 bg-muted rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 bg-muted rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 ProLanding. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Main Landing Page Component
export default function LandingClient() {
  const navItems = [
    { name: 'Home', url: '#home', icon: Home },
    { name: 'Features', url: '#features', icon: Zap },
    { name: 'Pricing', url: '#pricing', icon: TrendingUp },
    { name: 'Testimonials', url: '#testimonials', icon: Users }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar items={navItems} />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <TestimonialsSection />
      <Footer />
    </div>
  )
}
