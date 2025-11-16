const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 py-4 flex-shrink-0">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-gray-600">
          <p>
            © {currentYear} David's Salon Management System. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-primary-600 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary-600 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-primary-600 transition-colors">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
