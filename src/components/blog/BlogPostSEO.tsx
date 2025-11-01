import { useEffect } from 'react';
import { BlogPostWithRelations } from '../../types/blog';

interface BlogPostSEOProps {
  post: BlogPostWithRelations;
}

export const BlogPostSEO: React.FC<BlogPostSEOProps> = ({ post }) => {
  useEffect(() => {
    const metaTitle = post.meta_title || post.title;
    const metaDescription = post.meta_description || post.excerpt || post.body_content.substring(0, 160);
    const canonicalUrl = `https://primoboost.ai/blog/${post.slug}`;
    const imageUrl = post.featured_image_url || 'https://res.cloudinary.com/dlkovvlud/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg';

    document.title = `${metaTitle} | PrimoBoost AI Blog`;

    updateMetaTag('name', 'description', metaDescription);
    updateMetaTag('property', 'og:type', 'article');
    updateMetaTag('property', 'og:title', metaTitle);
    updateMetaTag('property', 'og:description', metaDescription);
    updateMetaTag('property', 'og:image', imageUrl);
    updateMetaTag('property', 'og:url', canonicalUrl);
    updateMetaTag('property', 'article:published_time', post.published_at || post.created_at);
    updateMetaTag('property', 'article:modified_time', post.updated_at);
    updateMetaTag('property', 'article:author', post.author_name || 'PrimoBoost AI');

    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', metaTitle);
    updateMetaTag('name', 'twitter:description', metaDescription);
    updateMetaTag('name', 'twitter:image', imageUrl);

    updateLinkTag('canonical', canonicalUrl);

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: metaDescription,
      image: imageUrl,
      datePublished: post.published_at || post.created_at,
      dateModified: post.updated_at,
      author: {
        '@type': 'Person',
        name: post.author_name || 'PrimoBoost AI'
      },
      publisher: {
        '@type': 'Organization',
        name: 'PrimoBoost AI',
        logo: {
          '@type': 'ImageObject',
          url: 'https://res.cloudinary.com/dlkovvlud/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg'
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl
      },
      articleSection: post.categories?.map(c => c.name).join(', '),
      keywords: post.tags?.map(t => t.name).join(', ')
    };

    let script = document.querySelector('script[type="application/ld+json"][data-blog-post]');
    if (!script) {
      script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-blog-post', 'true');
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);

    return () => {
      document.title = 'PrimoBoost AI - AI-Powered Resume Optimizer | ATS-Friendly Resume Builder';

      const scriptElement = document.querySelector('script[type="application/ld+json"][data-blog-post]');
      if (scriptElement) {
        scriptElement.remove();
      }
    };
  }, [post]);

  return null;
};

function updateMetaTag(attribute: string, key: string, content: string) {
  let element = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function updateLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}
