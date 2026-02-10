import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogPosts, blogCategories, getBlogPostBySlug, getBlogPostsByCategory } from '../../data/blogPosts';
import Footer from '../Footer/Footer';
import './BlogPage.scss';

const BlogPage = () => {
  const { slug } = useParams();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filteredPosts, setFilteredPosts] = useState(blogPosts);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    let filtered = getBlogPostsByCategory(selectedCategory);
    
    if (searchTerm) {
      filtered = filtered.filter(post => 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredPosts(filtered);
  }, [selectedCategory, searchTerm]);

  if (slug) {
    const post = getBlogPostBySlug(slug);
    
    if (!post) {
      return (
        <div className="blog-page">
          <div className="blog-container">
            <div className="blog-content">
              <div className="blog-not-found">
                <h1>Blog Post Not Found</h1>
                <p>The blog post you&apos;re looking for doesn&apos;t exist.</p>
                <Link to="/blog" className="back-to-blog-btn">
                  ← Back to Blog
                </Link>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      );
    }

    if (!post.content || typeof post.content !== 'string') {
      console.error('Blog post content is missing or invalid:', post);
      return (
        <div className="blog-page">
          <div className="blog-container">
            <div className="blog-content">
              <div className="blog-not-found">
                <h1>Blog Post Error</h1>
                <p>There was an issue loading this blog post. Please try again later.</p>
                <Link to="/blog" className="back-to-blog-btn">
                  ← Back to Blog
                </Link>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      );
    }

    console.log('Blog post content:', {
      title: post.title,
      contentLength: post.content.length,
      contentPreview: post.content.substring(0, 200) + '...',
      hasHtmlTags: /<[^>]*>/.test(post.content)
    });

    // XSS: content is from controlled blog data (blogPosts). Basic sanitization for defense in depth.
    // For user-generated HTML, use a library like DOMPurify instead.
    const sanitizedContent = post.content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();

    return (
      <div className="blog-page">
        <div className="blog-container">
          <div className="blog-content">
            {}
            <div className="blog-nav">
              <Link to="/blog" className="back-to-blog">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
                </svg>
                Back to Blog
              </Link>
            </div>

            {}
            <article className="blog-post">
              <header className="blog-post-header">
                <div className="blog-post-meta">
                  <span className="blog-post-category">{post.category}</span>
                  <span className="blog-post-date">{new Date(post.publishedDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                  <span className="blog-post-read-time">{post.readTime}</span>
                </div>
                
                <h1 className="blog-post-title">{post.title}</h1>
                
                <div className="blog-post-author">
                  <span>By {post.author}</span>
                </div>

                <div className="blog-post-featured-image">
                  <img src={post.featuredImage} alt={post.title} />
                </div>
              </header>

              {}
              <div className="blog-post-content">
                <div className="blog-post-excerpt">
                  <p>{post.excerpt}</p>
                </div>
                
                <div 
                  className="blog-post-body"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              </div>

              {}
              <footer className="blog-post-footer">
                <div className="blog-post-tags">
                  <span className="tags-label">Tags:</span>
                  {post.tags.map((tag, index) => (
                    <span key={index} className="blog-tag">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="blog-post-actions">
                  <Link to="/blog" className="back-to-blog-btn">
                    ← Back to All Posts
                  </Link>
                </div>
              </footer>
            </article>

            {}
            <section className="related-posts">
              <h3>More Articles</h3>
              <div className="related-posts-grid">
                {blogPosts
                  .filter(p => p.id !== post.id)
                  .slice(0, 3)
                  .map((relatedPost) => (
                    <Link 
                      key={relatedPost.id} 
                      to={`/blog/${relatedPost.slug}`}
                      className="related-post-card"
                    >
                      <div className="related-post-image">
                        <img src={relatedPost.featuredImage} alt={relatedPost.title} />
                      </div>
                      <div className="related-post-content">
                        <span className="related-post-category">{relatedPost.category}</span>
                        <h4>{relatedPost.title}</h4>
                        <p>{relatedPost.excerpt}</p>
                        <span className="related-post-date">
                          {new Date(relatedPost.publishedDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
            </section>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="blog-page">
      <div className="blog-container">
        <div className="blog-content">
          {}
          <div className="blog-header">
            <h1>MKD Blog</h1>
            <p>Insights, recipes, and stories from the world of kosher food delivery</p>
          </div>

          {}
          <div className="blog-filters">
            <div className="blog-search">
              <div className="search-input-container">
                <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="blog-categories">
              {blogCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {}
          {selectedCategory === 'All' && !searchTerm && (
            <section className="featured-post">
              <h2>Featured Article</h2>
              <Link to={`/blog/${blogPosts[0].slug}`} className="featured-post-card">
                <div className="featured-post-image">
                  <img src={blogPosts[0].featuredImage} alt={blogPosts[0].title} />
                  <div className="featured-post-overlay">
                    <span className="featured-post-category">{blogPosts[0].category}</span>
                  </div>
                </div>
                <div className="featured-post-content">
                  <h3>{blogPosts[0].title}</h3>
                  <p>{blogPosts[0].excerpt}</p>
                  <div className="featured-post-meta">
                    <span>By {blogPosts[0].author}</span>
                    <span>{new Date(blogPosts[0].publishedDate).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}</span>
                    <span>{blogPosts[0].readTime}</span>
                  </div>
                </div>
              </Link>
            </section>
          )}

          {}
          <section className="blog-posts">
            <div className="blog-posts-header">
              <h2>
                {selectedCategory === 'All' ? 'All Articles' : selectedCategory}
                {searchTerm && ` - "${searchTerm}"`}
              </h2>
              <span className="posts-count">
                {filteredPosts.length} article{filteredPosts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="no-posts">
                <p>No articles found matching your criteria.</p>
                <button 
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchTerm('');
                  }}
                  className="reset-filters-btn"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="blog-posts-grid">
                {filteredPosts.map((post) => (
                  <Link 
                    key={post.id} 
                    to={`/blog/${post.slug}`}
                    className="blog-post-card"
                  >
                    <div className="blog-post-image">
                      <img src={post.featuredImage} alt={post.title} />
                      <div className="blog-post-overlay">
                        <span className="blog-post-category">{post.category}</span>
                      </div>
                    </div>
                    <div className="blog-post-card-content">
                      <h3>{post.title}</h3>
                      <p>{post.excerpt}</p>
                      <div className="blog-post-card-meta">
                        <span>By {post.author}</span>
                        <span>{new Date(post.publishedDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}</span>
                        <span>{post.readTime}</span>
                      </div>
                      <div className="blog-post-tags">
                        {post.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="blog-tag-small">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BlogPage; 