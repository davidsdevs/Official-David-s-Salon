import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';

class MarketingContentService {
  constructor() {
    this.collection = 'marketingContents';
  }

  async getContent(contentId, type) {
    try {
      const contentRef = doc(db, this.collection, contentId);
      const contentDoc = await getDoc(contentRef);

      if (contentDoc.exists()) {
        const data = contentDoc.data();
        if (data.type === type) {
          return {
            success: true,
            content: {
              id: contentDoc.id,
              ...data
            }
          };
        }
      }

      return {
        success: true,
        content: type === 'homepage'
          ? this.getDefaultHomepageContent()
          : type === 'about'
          ? this.getDefaultAboutPageContent()
          : type === 'products'
          ? this.getDefaultProductsPageContent()
          : this.getDefaultBranchContent(contentId)
      };
    } catch (error) {
      console.error('Error getting marketing content:', error);
      return {
        success: false,
        message: error.message,
        content: type === 'homepage'
          ? this.getDefaultHomepageContent()
          : type === 'about'
          ? this.getDefaultAboutPageContent()
          : type === 'products'
          ? this.getDefaultProductsPageContent()
          : this.getDefaultBranchContent(contentId)
      };
    }
  }

  async getHomepageContent() {
    return this.getContent('main', 'homepage');
  }

  async getAboutPageContent() {
    return this.getContent('about', 'about');
  }

  async getProductsPageContent() {
    return this.getContent('products', 'products');
  }

  subscribeToContent(contentId, type, callback) {
    const contentRef = doc(db, this.collection, contentId);

    return onSnapshot(contentRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.type === type) {
          callback({
            success: true,
            content: {
              id: snapshot.id,
              ...data
            }
          });
        } else {
          callback({
            success: true,
            content: type === 'homepage'
              ? this.getDefaultHomepageContent()
              : type === 'about'
              ? this.getDefaultAboutPageContent()
              : type === 'products'
              ? this.getDefaultProductsPageContent()
              : this.getDefaultBranchContent(contentId)
          });
        }
      } else {
        callback({
          success: true,
          content: type === 'homepage'
            ? this.getDefaultHomepageContent()
            : type === 'about'
            ? this.getDefaultAboutPageContent()
            : type === 'products'
            ? this.getDefaultProductsPageContent()
            : this.getDefaultBranchContent(contentId)
        });
      }
    }, (error) => {
      console.error('Error in marketing content subscription:', error);
      callback({
        success: false,
        message: error.message,
        content: type === 'homepage'
          ? this.getDefaultHomepageContent()
          : type === 'about'
          ? this.getDefaultAboutPageContent()
          : type === 'products'
          ? this.getDefaultProductsPageContent()
          : this.getDefaultBranchContent(contentId)
      });
    });
  }

  async saveContent(contentId, type, contentData) {
    try {
      const contentRef = doc(db, this.collection, contentId);

      await setDoc(contentRef, {
        ...contentData,
        type,
        contentId,
        updatedAt: serverTimestamp(),
        updatedBy: contentData.updatedBy || null
      }, { merge: true });

      return { success: true };
    } catch (error) {
      console.error('Error saving marketing content:', error);
      return { success: false, message: error.message };
    }
  }

  async updateContent(contentId, type, contentData) {
    const contentRef = doc(db, this.collection, contentId);

    try {
      await updateDoc(contentRef, {
        ...contentData,
        type,
        contentId,
        updatedAt: serverTimestamp(),
        updatedBy: contentData.updatedBy || null
      });
      return { success: true };
    } catch (error) {
      if (error?.code === 'not-found') {
        try {
          await setDoc(contentRef, {
            ...contentData,
            type,
            contentId,
            updatedAt: serverTimestamp(),
            updatedBy: contentData.updatedBy || null
          }, { merge: true });
          return { success: true };
        } catch (innerError) {
          console.error('Error updating marketing content:', innerError);
          return { success: false, message: innerError.message };
        }
      }

      console.error('Error updating marketing content:', error);
      return { success: false, message: error.message };
    }
  }

  getDefaultHomepageContent() {
    return {
      type: 'homepage',
      contentId: 'main',
      theme: {
        primaryColor: '#160B53',
        heroOverlayBottomColor: '#160B53',
        heroOverlayBottomOpacity: 0.7,
        ctaBackgroundColor: '#160B53'
      },
      stats: {
        yearsExperience: '15+'
      },
      hero: {
        title: "Welcome to David's Salon",
        subtitle: "Experience premium hair and beauty services at our Harbor Point Ayala location. Discover our specialized services and exclusive offers tailored just for you.",
        buttonText: "View Our Services",
        backgroundImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%201-gwMUdJmDY3pIDaLqR4DsNsL8vwz2Fd.png",
        overlayOpacity: 0.6
      },
      branches: {
        title: "Choose Your Branch",
        subtitle: "",
        searchPlaceholder: "Search branches..."
      },
      testimonials: {
        title: "What Our Clients Say",
        subtitle: "Real stories from our satisfied customers",
        items: [
          {
            name: "Maria Gonzalez",
            branch: "Harbor Point Ayala",
            rating: 5,
            text: "I've been a loyal customer at Harbor Point Ayala for over 5 years, and the service quality and professionalism is remarkable. David's Salon truly understands Filipino beauty."
          },
          {
            name: "Jennifer Santos",
            branch: "Harbor Point Ayala",
            rating: 5,
            text: "The staff at Harbor Point Ayala are not just skilled, they're artists. The transformation was beyond my expectations. The European techniques combined with Filipino hospitality is unmatched!"
          },
          {
            name: "Carlos Mendoza",
            branch: "Harbor Point Ayala",
            rating: 5,
            text: "Harbor Point Ayala offers world-class service. The quality is exceptional, the location is convenient, and the prices are very reasonable."
          }
        ]
      },
      cta: {
        title: "Ready to Transform Your Look?",
        subtitle: "Visit our Harbor Point Ayala location to discover our exclusive services and book your appointment today.",
        buttonText: "View Our Services"
      },
      createdAt: null,
      updatedAt: null
    };
  }

  getDefaultProductsPageContent() {
    return {
      type: 'products',
      contentId: 'products',
      theme: {
        primaryColor: '#160B53'
      },
      header: {
        title: 'Products Catalog',
        subtitle: 'Browse our professional salon products',
        searchPlaceholder: 'Search products, brands...'
      },
      createdAt: null,
      updatedAt: null
    };
  }

  getDefaultAboutPageContent() {
    return {
      type: 'about',
      contentId: 'about',
      theme: {
        primaryColor: '#160B53',
        heroOverlayColor: '#160B53',
        heroOverlayOpacity: 0.7
      },
      hero: {
        title: "Our Story",
        subtitle: "From humble beginnings to becoming the Philippines' most trusted salon chain. Managed by industry experts with over 35 years of combined experience, we've built a legacy of excellence that spans generations and continues to set the standard for beauty and style.",
        backgroundImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/441497757_1392380064751655_248591870024847667_n%201-EoXi9uyyfemn6aMBujpw67luRG1Z7D.png"
      },
      stats: [
        { number: "200+", label: "Branches Nationwide" },
        { number: "1M+", label: "Happy Clients" },
        { number: "35+", label: "Years of Experience" },
        { number: "3", label: "Countries" }
      ],
      founder: {
        name: "David Charlton",
        role: "Founder",
        image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/DC%201-lnGIWn6aY2YuvXcg35yYsKsosL1eWp.png",
        description: [
          "David Charlton is a visionary entrepreneur with over three decades of experience in the beauty and wellness industry. His journey began in the early 1990s when he recognized the untapped potential in the Filipino market for premium salon services that combine international standards with local sensibilities.",
          "Under his leadership, David's Salon has grown from a single location to over 200 branches across the Philippines, establishing itself as the country's most trusted salon chain. His commitment to excellence and innovation has earned him recognition as one of the industry's most influential leaders.",
          "David's philosophy centers on empowering both clients and staff through continuous education, premium products, and personalized service. His vision extends beyond business success to creating meaningful impact in communities across the nation."
        ],
        quote: {
          title: "Industry Pioneer",
          text: "Our success lies in understanding that beauty is personal, and every client deserves to feel confident and beautiful."
        }
      },
      companyStory: {
        title: "Whoever you are, whatever you do, we bring out the best in you",
        paragraphs: [
          "David's Salon offers world-class hairdressing, fueled by Filipino passion. With the vision of bringing true European hairdressing to the Philippines, CEO David Charlton and the David's Salon's brand has made a name for itself, offering a wide range of hair and beauty services to a wide range of customers. It is a name that has been earned and followed by many Filipinos since its first salon opened in 1988. It is now the biggest chain of salons in the Philippines with over 200 branches all over the country.",
          "\"We take pride in providing the highest quality of service at prices everyone can afford,\" says Charlton. David's Salon's roster of services includes Hair Styling, Hair Color, Hot Oil and Scalp Treatments, Perming, Relaxing, Rebonding, Make Up, Waxing/Threading, Nail Care, and Hand and Foot Spa.",
          "A trusted salon brand such as David's Salon works with different trusted suppliers for hair care, hair color, and other kinds of technologies used for hair styling. Among these suppliers are Loreal, Wella Professional Service, Alfaparf Infiniti, and Schwarzkopf & Henkel.",
          "Total customers satisfaction is the goal of David's Salon. The David's Salon Experience is one where customers are given relaxing ambiance, professional consultations from creative stylists, and personal assistance by store managers and store assistants.",
          "Clients are pampered as they are given quality service with professional care coming from a well-trained team. David's Salon has a solid core business management team equipped themselves with the latest and most innovative European hairdressing technology, which they generously and systematically pass on to every David's Salon stylist."
        ]
      },
      ceo: {
        name: "Laura Charlton",
        role: "CEO and President",
        image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/DC%201%20%281%29-naiRFHoiiPP970mA8FxdHoiQjnpvAz.png",
        description: [
          "Laura Charlton brings over two decades of operational excellence to David's Salon. As CEO and President, she oversees the day-to-day operations of all branches, ensuring consistent quality and service standards across the entire network.",
          "Her expertise in staff training and development has been instrumental in building David's Salon's reputation for exceptional service. Laura's commitment to continuous improvement and innovation has helped establish the company as an industry leader in the Philippines.",
          "Under her guidance, David's Salon has implemented cutting-edge training programs and quality assurance systems that ensure every client receives the premium experience they deserve, regardless of which branch they visit."
        ]
      },
      team: {
        title: "Our Team",
        executive: [
          {
            name: "Marivic Aguibiador",
            role: "Executive Vice President for Finance and Operations",
            image: "/images/team/executives/marivicaguibiador.jpg"
          },
          {
            name: "Maria Luisa Flores",
            role: "Vice President for Human Resources",
            image: "/images/team/executives/marialuisa.jpg"
          }
        ],
        management: [
          {
            name: "Jeng Sy",
            role: "Retail Department Manager",
            image: "/images/team/management/jengsy.jpg"
          },
          {
            name: "Lorna Sandoval",
            role: "Academy Training Director",
            image: "/images/team/management/lornasandoval.jpg"
          },
          {
            name: "Hanna Riñon de Grano",
            role: "Purchasing Department Manager",
            image: "/images/team/management/hannarinon.jpg"
          }
        ]
      },
      whyChoose: {
        title: "Why Choose David's Salon",
        subtitle: "Where every client receives exceptional service and achieves their desired look with personalized care for every client.",
        benefits: [
          {
            icon: "Award",
            title: "Expert stylists",
            description: "Experienced professionals trained in the latest techniques and trends."
          },
          {
            icon: "Users",
            title: "Premium products",
            description: "High-quality products and tools for the best results."
          },
          {
            icon: "Clock",
            title: "Customized solutions",
            description: "Tailored treatments that fit your unique style and preferences."
          },
          {
            icon: "Globe",
            title: "International standards",
            description: "World-class service with Filipino hospitality and warmth."
          }
        ]
      },
      createdAt: null,
      updatedAt: null
    };
  }

  getDefaultBranchContent(contentId) {
    return {
      type: 'branch',
      contentId,
      navigation: {
        bookNowText: 'BOOK NOW',
        links: {
          home: 'HOME',
          services: 'SERVICES',
          stylists: 'STYLISTS',
          gallery: 'GALLERY',
          products: 'PRODUCTS'
        }
      },
      footer: {
        description: "Premium hair and beauty services at {branchName}. We offer specialized services tailored to our local community with professional stylists and modern facilities.",
        linksTitle: 'Branch Links',
        contactTitle: 'Contact Info',
        links: {
          home: 'Branch Home',
          services: 'Our Services',
          stylists: 'Our Stylists',
          gallery: 'Gallery',
          products: 'Products'
        },
        copyright: "© 2025 David's Salon - {branchName}. All Rights Reserved."
      },
      servicesPage: {
        header: {
          title: 'Services',
          subtitle: 'Professional hair and beauty services tailored to your needs'
        },
        cta: {
          title: 'Ready to Transform Your Look?',
          subtitle: 'Book your appointment today and experience our professional services',
          primaryButtonText: 'Book Appointment',
          secondaryButtonText: 'Call Us Now'
        }
      },
      productsPage: {
        header: {
          title: 'Products Catalog',
          subtitle: 'Professional hair care products available at {branchName} Branch'
        },
        searchPlaceholder: 'Search products, brands...'
      },
      stylistsPage: {
        header: {
          title: 'Stylists',
          subtitle: 'Meet our team of expert stylists ready to transform your look'
        },
        filters: {
          allLabel: 'All'
        },
        emptyState: {
          title: 'No stylists found',
          subtitle: 'Try selecting a different category'
        },
        buttons: {
          viewProfileText: 'View Profile'
        },
        cta: {
          title: 'Ready to Book with Our Experts?',
          subtitle: 'Choose your preferred stylist and schedule your appointment today',
          primaryButtonText: 'Book Appointment',
          secondaryButtonText: 'Call Us Now'
        }
      },
      theme: {
        primaryColor: '#160B53',
        heroOverlayBottomColor: '#160B53',
        heroOverlayBottomOpacity: 0.7,
        ctaBackgroundColor: '#160B53'
      },
      hero: {
        title: "David's Salon Branch",
        subtitle: "Choose your preferred branch to discover our specialized services and exclusive offers tailored just for you. Each location offers unique experiences designed for our local community.",
        buttonText: 'Choose another branch',
        backgroundImage: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%201-gwMUdJmDY3pIDaLqR4DsNsL8vwz2Fd.png',
        overlayOpacity: 0.6,
        statistics: {
          branches: 7,
          clients: '50K+',
          years: '15+'
        }
      },
      services: {
        title: 'Explore Our Services',
        subtitle: 'Discover what makes this branch special',
        categoryCardButtonText: 'View More',
        items: []
      },
      popularServices: {
        title: 'Popular Services',
        subtitle: 'Our most requested treatments',
        items: []
      },
      stylists: {
        title: 'Meet Our Top Stylists',
        subtitle: 'Expert professionals ready to transform your look',
        items: []
      },
      gallery: {
        title: 'Our Work',
        subtitle: 'See our work and salon atmosphere',
        items: []
      },
      testimonials: {
        title: 'What Our Clients Say',
        subtitle: 'Real stories from our satisfied customers',
        items: []
      },
      visitBranch: {
        title: 'Visit Branch',
        subtitle: 'Find us and get in touch',
        locationLabel: 'Location',
        phoneLabel: 'Contact',
        hoursLabel: 'Hours',
        location: '',
        phone: '',
        hours: ''
      },
      contactInfo: {
        title: 'Visit Us',
        subtitle: 'Get in touch with our team',
        addressLabel: 'Address',
        phoneLabel: 'Phone',
        hoursLabel: 'Hours',
        address: '',
        phone: '',
        hours: '',
        bookingCta: {
          title: 'Ready to Book?',
          subtitle: 'Call us now to schedule your appointment',
          callButtonPrefix: 'Call',
          footerText: 'Or visit us at our location'
        }
      },
      createdAt: null,
      updatedAt: null
    };
  }
}

export const marketingContentService = new MarketingContentService();
export default marketingContentService;
